// @vitest-environment node
import type { SendEmailCommandInput } from '@aws-sdk/client-ses'

import mjml2html from 'mjml'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendEmail } from '../../server/utils/sendEmail'

const { sentCommands, sentSignals } = vi.hoisted(() => ({
  sentCommands: [] as SendEmailCommandInput[],
  sentSignals: [] as (AbortSignal | undefined)[],
}))

vi.mock('mjml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mjml')>()
  return { ...actual, default: vi.fn(actual.default) }
})

mockNuxtImport('useRuntimeConfig', () => () => ({
  awsRegion: 'eu-central-1',
  awsAccessKeyId: 'test-key',
  awsSecretAccessKey: 'test-secret',
  public: { cdnUrl: 'https://cdn.example.com' },
  email: { from: 'sender@example.com' },
}))

vi.mock('@aws-sdk/client-ses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-ses')>()
  return {
    ...actual,
    SESClient: class {
      async send(command: InstanceType<typeof actual.SendEmailCommand>, options?: { abortSignal?: AbortSignal }) {
        sentCommands.push(command.input)
        sentSignals.push(options?.abortSignal)
        return { MessageId: 'test' }
      }
    },
  }
})

const templates = [
  'verificationCode',
  'newComment',
  'commentReply',
  'deleteComment',
  'userBan',
  'tenantInvitation',
  'tenantMemberRemoved',
  'creditsDepleted',
] as const
const locales = ['en', 'cs', 'de', 'fr'] as const
const cases = locales.flatMap((locale) => templates.map((template) => ({ locale, template })))
const data = {
  userName: 'Alice',
  articleTitle: 'Test article',
  commentContent: 'A useful comment',
  parentUsername: 'Bob',
  parentContent: 'Original comment',
  deleteReason: 'Spam',
  verificationCode: '123456',
  actionType: 'account creation',
  tenantName: 'Test publication',
  tenantDescription: 'Publication description',
  tenantDomain: 'example.com',
  followerCount: '42',
  inviterName: 'Carol',
  scopeCount: '3',
  expirationDays: '7',
  removedBy: 'Carol',
  removedAt: '2026-10-08',
  ownerEmail: 'owner@example.com',
  clientSiteId: 'test-site',
  introKey: 'intro_with_reason_temporary',
  reason: 'Spam',
  banDuration: '2026-10-09',
  commentUrl: 'https://example.com/comment',
  invitationUrl: 'https://example.com/invitation',
  topUpUrl: 'https://example.com/top-up',
  unsubscribeUrl: 'https://example.com/unsubscribe',
}

describe('transactional email rendering', () => {
  it('escapes user data before MJML interpretation and preserves reset expiry in both bodies', async () => {
    await sendEmail({
      to: 'reader@example.invalid',
      lang: 'en',
      template: 'verificationCode',
      data: { ...data, userName: '</mj-text><mj-text>Injected section</mj-text>', expirationKey: 'resetExpiration' },
    })
    const email = sentCommands.at(-1)!
    expect(email.Message?.Body?.Html?.Data).toContain('&lt;/mj-text&gt;')
    expect(email.Message?.Body?.Html?.Data).toContain('15 minutes')
    expect(email.Message?.Body?.Text?.Data).toContain('15 minutes')
    expect(email.Message?.Body?.Text?.Data).not.toContain('24 hours')
  })
  beforeEach(() => {
    sentCommands.length = 0
    sentSignals.length = 0
    vi.stubGlobal('useStorage', (base: string) => {
      const directory = join(process.cwd(), 'emails', base.endsWith('locales') ? 'locales' : 'templates')
      return {
        getItem: async (key: string) => JSON.parse(await readFile(join(directory, key), 'utf8')),
        getItemRaw: async (key: string) => readFile(join(directory, key)),
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('forwards the caller timeout signal to the mail transport', async () => {
    const controller = new AbortController()
    await sendEmail({
      to: 'reader@example.invalid',
      lang: 'en',
      template: 'verificationCode',
      data,
      abortSignal: controller.signal,
    })
    expect(sentSignals).toEqual([controller.signal])
  })

  it('keeps rendered verification secrets out of MJML validation diagnostics', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(mjml2html).mockResolvedValueOnce({
      html: '<html></html>',
      json: { tagName: 'mjml', children: [] },
      errors: [{ line: 1, tagName: 'mj-text', message: 'aabbccdd', formattedMessage: '<mj-text>aabbccdd</mj-text>' }],
    })
    await sendEmail({ to: 'reader@example.invalid', lang: 'en', template: 'verificationCode', data })
    expect(warn).toHaveBeenCalledOnce()
    expect(JSON.stringify(warn.mock.calls)).not.toContain('aabbccdd')
    expect(warn).toHaveBeenCalledWith('[MJML Validation Warnings]:', { template: 'verificationCode', count: 1 })
  })

  it('keeps rendered verification secrets out of MJML compilation failures', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mjml2html).mockRejectedValueOnce(new Error('Invalid rendered token aabbccdd'))
    await expect(
      sendEmail({ to: 'reader@example.invalid', lang: 'en', template: 'verificationCode', data }),
    ).rejects.toThrow('MJML compilation failed')
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]![1]).toEqual({ template: 'verificationCode' })
  })

  it.each(cases)('renders $template in $locale with HTML and plain text', async ({ locale, template }) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const messages = JSON.parse(await readFile(join(process.cwd(), 'emails/locales', `${locale}.json`), 'utf8'))
    const subject = messages[template].subject.replace(/\{(\w+)\}/g, (_: string, key: keyof typeof data) => data[key])

    await sendEmail({ to: 'recipient@example.com', lang: locale, template, data })

    expect(warn).not.toHaveBeenCalled()
    expect(sentCommands).toHaveLength(1)
    const email = sentCommands[0]!
    expect(email.Source).toBe('sender@example.com')
    expect(email.Destination?.ToAddresses).toEqual(['recipient@example.com'])
    expect(email.Message?.Subject?.Data).toBe(subject)
    expect(email.Message?.Body?.Html?.Data).toMatch(/<!doctype html>/i)
    expect(email.Message?.Body?.Html?.Data).toContain('https://cdn.example.com/app-logo.png')
    expect(email.Message?.Body?.Html?.Data).not.toMatch(/\{(?:t:|verificationCode|tenantName|introKey)/)
    expect(email.Message?.Body?.Text?.Data).toBeTruthy()
    expect(email.Message?.Body?.Text?.Data).not.toMatch(/<[^>]+>|\{\w+\}/)
    if (template === 'verificationCode') {
      expect(email.Message?.Body?.Html?.Data).toContain(data.verificationCode)
      expect(email.Message?.Body?.Text?.Data).toContain(data.verificationCode)
    }
  })
})
