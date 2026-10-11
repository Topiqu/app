import { createError } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveAiUser } from '../../server/utils/aiUser'
import { TENANT_SCOPES } from '../../server/utils/tenantMembership'
import { requireDomainAccess } from '../../server/utils/domainVerification'

type Scope = (typeof TENANT_SCOPES)[number]

const handlers = import.meta.glob('../../server/api/**/*.ts')

// Each handler runs against a member holding every scope except the one under test.
const routes: [file: string, scope: Scope, body?: Record<string, unknown>][] = [
  ['tags/[id]/index.patch', 'ARTICLE_WRITE'],
  ['tags/[id]/index.delete', 'ARTICLE_WRITE'],
  ['series/index.post', 'ARTICLE_WRITE', { title: 'Series' }],
  ['media/[id]/index.delete', 'ARTICLE_WRITE'],
  ['articles/[id]/index.delete', 'ARTICLE_WRITE'],
  ['articles/[id]/index.delete', 'ARTICLE_WRITE_OTHERS'],
  ['articles/[id]/translate.post', 'ARTICLE_WRITE', { language: 'en' }],
  ['articles/[id]/index.patch', 'ARTICLE_PUBLISH', { status: 'published' }],
  ['articles/export-pdf.post', 'ARTICLE_WRITE', { ids: ['a1'] }],
  ['tenant/members/[id].patch', 'MEMBER_CONTROL', { scopes: [] }],
  ['tenant/members/[id].delete', 'MEMBER_CONTROL'],
  ['tenant/invitations.post', 'MEMBER_CONTROL', { email: 'a@example.com', scopes: [] }],
  ['tenant/invitations/[id].delete', 'MEMBER_CONTROL'],
  ['tenant/invitations/[id]/resend.post', 'MEMBER_CONTROL'],
  ['emojis/index.post', 'TENANT_SETTINGS'],
  ['emojis/[id]/index.patch', 'TENANT_SETTINGS', { shortcode: 'party' }],
  ['emojis/[id]/index.delete', 'TENANT_SETTINGS'],
  ['admin/domain-verification/start.post', 'TENANT_SETTINGS'],
  ['admin/domain-verification/check.post', 'TENANT_SETTINGS'],
  ['clients/[id]/index.patch', 'TENANT_SETTINGS'],
  ['clients/[id]/palette.post', 'TENANT_SETTINGS'],
  ['clients/[id]/ai-avatar.delete', 'TENANT_SETTINGS'],
  ['widgets/index.put', 'TENANT_SETTINGS', { widgets: [] }],
  ['keyword-plan/index.patch', 'TENANT_SETTINGS'],
  ['drafts/[id]/approve.post', 'INTEGRATION_CONTROL'],
  ['drafts/[id]/reject.post', 'INTEGRATION_CONTROL', { reason: 'no' }],
  ['publish/[id].post', 'INTEGRATION_CONTROL'],
  ['companies/my-company.post', 'INTEGRATION_CONTROL', { mode: 'manual' }],
  ['search-console/index.delete', 'INTEGRATION_CONTROL'],
  ['search-console/autopilot.patch', 'INTEGRATION_CONTROL', { enabled: true }],
  ['stripe/portal.post', 'BILLING_CHANGE', { origin: 'https://example.com' }],
  ['stripe/subscribe.post', 'BILLING_CHANGE', { plan: 'PRO' }],
  ['clients/[id]/features.patch', 'BILLING_CHANGE', { code: 'AI', enabled: true }],
  ['clients/end-trial.post', 'BILLING_CHANGE'],
  ['clients/[id]/api-key.post', 'API_KEY_CONTROL'],
  ['ai-visibility/prompts/[id].delete', 'AI_USE'],
  ['ai-visibility/prompts/index.post', 'AI_USE', { prompt: 'best coffee' }],
  ['keyword-plan/[id].patch', 'AI_USE', { status: 'PINNED' }],
  ['backlinks/discover.post', 'ANALYTICS_READ'],
  ['ai-visibility/domains.put', 'ANALYTICS_READ', { domains: [] }],
  ['bans/[id]/index.post', 'CONTENT_MODERATE', { reason: 'spam' }],
  ['bans/[id]/index.delete', 'CONTENT_MODERATE'],
  ['comments/[id]/index.delete', 'CONTENT_MODERATE'],
]

const user = { id: 'member', role: 'admin', clientSiteId: 'site-1', plan: 'PRO', scopes: [] }
const row = {
  id: 'site-1',
  userId: 'colleague',
  clientSiteId: 'site-1',
  role: 'MEMBER',
  scopes: [],
  status: 'draft',
  deletedAt: null,
  domain: 'blog.example.com',
  article: { userId: 'colleague', clientSiteId: 'site-1' },
  task: { company: { clientSiteId: 'site-1', clientSite: { publishToLinkedIn: true } } },
}

const WRITE = /^(create|update|upsert|delete|\$transaction|\$execute)/

const database = (writes: string[]) =>
  new Proxy({} as Record<string, unknown>, {
    get: (_, model: string) => {
      if (model === 'then') return undefined
      if (WRITE.test(model))
        return async () => {
          writes.push(model)
        }
      return new Proxy({} as Record<string, unknown>, {
        get: (_, method: string) => async () => {
          if (WRITE.test(method)) writes.push(`${model}.${method}`)
          return method.startsWith('findMany') ? [] : method === 'count' ? 0 : { ...row }
        },
      })
    },
  })

const run = async (file: string, scope: Scope, body: Record<string, unknown> = {}) => {
  const writes: string[] = []
  const checked: string[] = []
  const db = database(writes)
  const membership = { id: 'membership', clientSiteId: 'site-1', userId: user.id, role: 'MEMBER' as const }
  const denied = () => createError({ statusCode: 403, message: `Missing tenant scope: ${scope}` })
  const requireTenantScope = async (_event: unknown, required: Scope) => {
    checked.push(required)
    if (required === scope) throw denied()
    return { user, membership: { ...membership, scopes: TENANT_SCOPES.filter((s) => s !== scope) } }
  }

  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => user)
  vi.stubGlobal('requireUser', async () => user)
  vi.stubGlobal('requireDb', async () => ({ user, db }))
  vi.stubGlobal('requireTenantScope', requireTenantScope)
  vi.stubGlobal('requireTenantMember', async () => ({
    user,
    membership: { ...membership, scopes: TENANT_SCOPES.filter((s) => s !== scope) },
  }))
  vi.stubGlobal('hasTenantScope', (_membership: unknown, required: Scope) => {
    checked.push(required)
    return required !== scope
  })
  vi.stubGlobal('requireArticleAccess', async (event: unknown) => {
    await requireTenantScope(event, 'ARTICLE_WRITE')
    await requireTenantScope(event, 'ARTICLE_WRITE_OTHERS')
    return { user, membership, article: row }
  })
  vi.stubGlobal('requireDomainAccess', requireDomainAccess)
  vi.stubGlobal('resolveAiUser', resolveAiUser)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('getRouterParam', () => 'site-1')
  vi.stubGlobal('getQuery', () => ({}))
  vi.stubGlobal('readBody', async () => body)
  vi.stubGlobal('readValidatedBody', async () => body)
  vi.stubGlobal('readMultipartFormData', async () => [
    { name: 'shortcode', data: Buffer.from('party') },
    { name: 'file', filename: 'party.png', type: 'image/png', data: Buffer.from('png') },
  ])
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('TENANT_SCOPES', TENANT_SCOPES)
  vi.stubGlobal('isCoverImageUrl', () => true)

  const { default: handler } = (await handlers[`../../server/api/${file}.ts`]!()) as {
    default: (event: unknown) => Promise<unknown>
  }
  const result = await handler({ context: { params: { id: 'site-1' } }, headers: new Headers() }).then(
    () => null,
    (error: unknown) => error,
  )
  return { result, writes, checked }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('tenant scope matrix', () => {
  it('covers every tenant scope', () => {
    expect(new Set(routes.map(([, scope]) => scope))).toEqual(new Set(TENANT_SCOPES))
  })

  it.each(routes)('%s is refused without %s', async (file, scope, body) => {
    const { result, writes, checked } = await run(file, scope, body)
    if (!(result as { statusCode?: number } | null)?.statusCode) throw result ?? new Error('handler resolved')
    expect(checked).toContain(scope)
    expect(result).toMatchObject({ statusCode: 403 })
    expect(writes).toEqual([])
  })
})
