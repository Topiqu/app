import { afterEach, expect, it, vi } from 'vitest'

import { uiLanguageOf } from '../../shared/utils/language'
import { domainAdminNotifications } from '../../server/utils/domains/notifications'

afterEach(() => vi.unstubAllGlobals())

it('does not send a notification row with an absent translation', async () => {
  const report = vi.fn()
  vi.stubGlobal('prisma', {
    tenantMembership: {
      findMany: async () => [
        { userId: 'user-en', user: { language: 'en' } },
        { userId: 'user-cs', user: { language: 'cs' } },
      ],
    },
  })
  vi.stubGlobal(
    'getServerTranslator',
    async (locale: string) => () => (locale === 'en' ? 'Domain needs attention' : undefined),
  )
  vi.stubGlobal('reportCaughtError', report)
  vi.stubGlobal('uiLanguageOf', uiLanguageOf)
  await expect(domainAdminNotifications('site-1', 'domain.status', 'example.invalid')).resolves.toEqual([
    { userId: 'user-en', type: 'SYSTEM', message: 'Domain needs attention', link: '/en/settings?tab=branding' },
  ])
  expect(report).toHaveBeenCalledTimes(1)
})
