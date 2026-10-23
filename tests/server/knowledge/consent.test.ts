import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'
import { KNOWLEDGE_CONSENT_VERSION } from '../../../shared/utils/knowledge'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/images/publicFetch'), 'assertPublicHttpsUrl')
  await stubNitroImports(
    import('../../../server/utils/knowledge/extract'),
    'extractKnowledgeFile',
    'extractKnowledgeUrl',
    'normalizeKnowledgeText',
    'KnowledgeExtractError',
  )
  await stubNitroImports(import('../../../server/utils/knowledge/indexing'), 'indexKnowledgeSource')
  await stubNitroImports(
    import('../../../server/utils/knowledge/sources'),
    'assertCitableUrl',
    'hashKnowledge',
    'kickKnowledgeIndex',
    'knowledgeExtractFailure',
    'knowledgeLimits',
    'KNOWLEDGE_SOURCE_VIEW',
    'limitKnowledgeRequests',
    'requireKnowledgeAccess',
  )
}

const part = (name: string, value: string) => ({ name, data: Buffer.from(value) })

const stubServer = (db: Record<string, unknown>) => {
  const log = vi.fn()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'user-1', clientSiteId: 'site-1' } }))
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('requireAiPlan', async () => {})
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('getIp', () => '203.0.113.9')
  vi.stubGlobal('getRequestHeader', () => undefined)
  vi.stubGlobal('setResponseStatus', vi.fn())
  vi.stubGlobal('logAction', log)
  vi.stubGlobal('reportCaughtError', vi.fn())
  vi.stubGlobal('prisma', {
    clientSite: { findUnique: vi.fn().mockResolvedValue({ plan: 'PRO' }) },
    knowledgeSource: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ sources: 0, characters: 0 }]),
  })
  return log
}

describe('knowledge publish confirmation', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.unstubAllGlobals()
    await stubImports()
  })

  const createNote = async (confirmed?: string) => {
    const create = vi.fn().mockResolvedValue({ id: 'source-1', kind: 'NOTE' })
    const log = stubServer({ knowledgeSource: { findFirst: vi.fn().mockResolvedValue(null), create } })
    const parts = [part('kind', 'NOTE'), part('title', 'Pricing'), part('text', 'The Pro plan costs 49 USD per month.')]
    vi.stubGlobal('readMultipartFormData', async () => (confirmed ? [...parts, part('confirmed', confirmed)] : parts))
    const handler = (await import('../../../server/api/knowledge/index.post')).default
    return { run: () => handler({} as never), create, log }
  }

  it('refuses a new source that was not confirmed, before storing anything', async () => {
    const { run, create } = await createNote()
    await expect(run()).rejects.toMatchObject({ statusCode: 400, data: { code: 'KNOWLEDGE_CONSENT' } })
    expect(create).not.toHaveBeenCalled()
  })

  it('records the confirmation with its wording version in the audit log', async () => {
    const { run, log } = await createNote('true')
    await run()
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'KNOWLEDGE_SOURCE_CREATED',
        userId: 'user-1',
        ip: '203.0.113.9',
        metadata: expect.objectContaining({
          consent: { version: KNOWLEDGE_CONSENT_VERSION, confirmedAt: expect.any(String) },
        }),
      }),
    )
  })

  const editNote = async (body: Record<string, unknown>, kind = 'NOTE') => {
    const update = vi.fn().mockResolvedValue({ id: 'source-1', publicUrl: null })
    const log = stubServer({
      knowledgeSource: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'source-1', kind, title: 'Pricing', contentHash: 'old', publicUrl: null }),
        update,
      },
    })
    vi.stubGlobal('getRouterParam', () => 'source-1')
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
    const handler = (await import('../../../server/api/knowledge/[id].patch')).default
    return { run: () => handler({} as never), update, log }
  }

  it('asks again when a note gets new text', async () => {
    const { run, update } = await editNote({ text: 'The Pro plan now costs 59 USD.' })
    await expect(run()).rejects.toMatchObject({ statusCode: 400, data: { code: 'KNOWLEDGE_CONSENT' } })
    expect(update).not.toHaveBeenCalled()
  })

  it('logs the confirmation for new text and needs none for a rename', async () => {
    const changed = await editNote({ text: 'The Pro plan now costs 59 USD.', confirmed: true })
    await changed.run()
    expect(changed.log.mock.calls[0]![0].metadata.consent.version).toBe(KNOWLEDGE_CONSENT_VERSION)

    const renamed = await editNote({ title: 'Pricing 2026' })
    await renamed.run()
    expect(renamed.log.mock.calls[0]![0].metadata).not.toHaveProperty('consent')
  })

  it('requeues a renamed document because its title is part of the embedded text', async () => {
    const renamed = await editNote({ title: 'Pricing 2026' })
    await renamed.run()
    expect(renamed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 }, status: 'PENDING', indexingToken: null }),
      }),
    )
  })

  it('does not re-embed an unchanged title or a feed display-name change', async () => {
    for (const [title, kind] of [
      ['Pricing', 'NOTE'],
      ['Shop 2026', 'FEED'],
    ] as const) {
      const edit = await editNote({ title }, kind)
      await edit.run()
      expect(edit.update.mock.calls[0]![0].data).not.toHaveProperty('version')
    }
  })
})
