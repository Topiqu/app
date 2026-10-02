import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyCreditsDepleted } from '../../../server/utils/creditsDepleted'

const site = (overrides = {}) => ({
  name: 'Herní magazín',
  domain: 'hry.topiqu.com',
  logoUrl: null,
  articleCreditWallet: { grants: [{ id: 'grant-2' }] },
  tenantMemberships: [
    { user: { id: 'owner', email: 'owner@example.com', language: 'cs' } },
    { user: { id: 'billing', email: 'billing@example.com', language: 'de' } },
  ],
  ...overrides,
})

const findSite = vi.fn()
const findLog = vi.fn()
const sendEmail = vi.fn()
const logAction = vi.fn()

beforeEach(() => {
  findSite.mockResolvedValue(site())
  findLog.mockResolvedValue(null)
  vi.stubGlobal('prisma', { clientSite: { findUnique: findSite }, log: { findUnique: findLog } })
  vi.stubGlobal('sendEmail', sendEmail)
  vi.stubGlobal('logAction', logAction)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('notifyCreditsDepleted', () => {
  it('emails each owner and billing member in their language with a localized top-up link', async () => {
    await expect(notifyCreditsDepleted('site-1')).resolves.toEqual({ sent: 2 })

    expect(sendEmail.mock.calls.map(([email]) => [email.to, email.lang, email.data.topUpUrl])).toEqual([
      ['owner@example.com', 'cs', expect.stringMatching(/\/cs\/settings\?tab=billing$/)],
      ['billing@example.com', 'de', expect.stringMatching(/\/de\/settings\?tab=billing$/)],
    ])
    expect(sendEmail.mock.calls[0]![0].template).toBe('creditsDepleted')
  })

  it('asks only for verified owners and billing members, never the AI author', async () => {
    await notifyCreditsDepleted('site-1')
    expect(findSite.mock.calls[0]![0].select.tenantMemberships.where).toEqual({
      deletedAt: null,
      OR: [{ role: 'OWNER' }, { scopes: { has: 'BILLING_CHANGE' } }],
      user: { emailVerified: true, role: { not: 'ai' } },
    })
  })

  // The key names the newest grant: a top-up re-arms the email, another cron run does not.
  it('records the notice per grant and stays quiet once it exists', async () => {
    await notifyCreditsDepleted('site-1')
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREDITS_DEPLETED_NOTIFIED',
        idempotencyKey: 'credits-depleted:site-1:grant-2',
      }),
    )

    sendEmail.mockClear()
    findLog.mockResolvedValue({ id: 'log-1' })
    await expect(notifyCreditsDepleted('site-1')).resolves.toEqual({ sent: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('leaves no record when sending fails, so the next run retries', async () => {
    sendEmail.mockRejectedValueOnce(new Error('SES down'))
    await expect(notifyCreditsDepleted('site-1')).rejects.toThrow('SES down')
    expect(logAction).not.toHaveBeenCalled()
  })

  it('does nothing for a site without anyone to tell', async () => {
    findSite.mockResolvedValue(site({ tenantMemberships: [] }))
    await expect(notifyCreditsDepleted('site-1')).resolves.toEqual({ sent: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
