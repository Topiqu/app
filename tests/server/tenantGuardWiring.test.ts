import { describe, expect, it } from 'vitest'
import { join, relative, resolve } from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

const API = resolve(process.cwd(), 'server/api')
const GUARD =
  /requireTenantScope|requireTenantMember|requireArticleAccess|hasTenantScope|requireDomainAccess|requireShopifyAccess|requireWebhookAccess|requireKnowledgeAccess|resolveAiUser/

// Routes that write without a tenant scope, each for a reason that is not "nobody checked".
const exempt: Record<string, string> = {
  'domain/probe.post.ts': 'public nonce-bound routing proof; rate limited, no session or tenant content',
  'admin/verify-domain.post.ts': 're-exports domain-verification/check.post',
  'clients/[id]/index.delete.ts': 'superadmin only',
  'clients/[id]/wallet-adjustments.post.ts': 'superadmin only',
  'clients/index.post.ts': 'superadmin only',
  'users/index.post.ts': 'superadmin only',
  'users/[id]/index.delete.ts': 'self or superadmin',
  'users/[id]/index.patch.ts': 'self or superadmin',
  'users/avatar.post.ts': 'own account',
  'users/avatar.delete.ts': 'own account',
  'users/totp.post.ts': 'own account',
  'users/verify-totp.post.ts': 'own account',
  'users/send-verification.post.ts': 'own account',
  'users/unsubscribe.post.ts': 'signed unsubscribe link',
  'sessions/ping.post.ts': 'own session',
  'sessions/[sessionId].delete.ts': 'own session',
  'notifications/index.post.ts': 'own notifications',
  'notifications/[id]/index.delete.ts': 'own notifications',
  'sessions/others.delete.ts':
    'only the current account’s other sessions; current-session exclusion and same-origin guard',
  'follows/index.post.ts': 'reader action',
  'follows/[id]/index.delete.ts': 'reader action',
  'consent/analytics.delete.ts': 'visitor consent',
  'articles/draft/index.delete.ts': 'own recovery draft, pinned to user and tenant',
  'articles/[id]/feedback.post.ts': 'reader action',
  'articles/[id]/reaction.post.ts': 'reader action',
  'articles/[id]/share.post.ts': 'reader action',
  'articles/[id]/view.post.ts': 'reader action',
  'articles/[id]/vote.post.ts': 'reader action',
  'comments/index.post.ts': 'reader action',
  'comments/reaction.post.ts': 'reader action',
  'emojis/reaction.post.ts': 'reader action',
  'tenant/active.post.ts': 'switches between the caller’s own memberships',
  'tenant/index.post.ts': 'creates a tenant owned by the caller',
  'invitations/[token].post.ts': 'invitation token is the credential',
  'onboarding/checkout.post.ts': 'signup before a tenant exists',
  'onboarding/send-code.post.ts': 'signup before a tenant exists',
  'onboarding/verify-code.post.ts': 'signup before a tenant exists',
  'shopify/app/session.post.ts': 'Shopify ID token',
  'shopify/webhooks.post.ts': 'Shopify HMAC',
  'shopify/link.delete.ts': 'clears the caller’s own link cookie',
  'stripe/webhook.ts': 'Stripe signature',
  'articles/[id]/vote.ts': 'public read',
  'articles/[id]/available-tags.ts': 'policy-scoped read',
  'articles/by-clientsite/[slug].ts': 'public read',
  'articles/featured/[slug].ts': 'public read',
  'clients/slug/[slug].ts': 'public read',
  'emojis/[id]/by-article.ts': 'public read',
  'tags/slug/[slug].ts': 'public read',
}
const exemptPrefixes = ['_dev/', 'auth/', 'crons/']

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  )

// Reads (`.get.ts`) are policy-scoped; everything else can mutate.
const routes = files(API)
  .map((file) => relative(API, file).replaceAll('\\', '/'))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.get.ts'))

describe('tenant guard wiring', () => {
  it('guards every mutating route with a tenant scope or a stated exemption', () => {
    const unguarded = routes.filter(
      (file) =>
        !exempt[file] &&
        !exemptPrefixes.some((prefix) => file.startsWith(prefix)) &&
        !GUARD.test(readFileSync(join(API, file), 'utf8')),
    )
    expect(unguarded).toEqual([])
  })

  it('keeps the exemption list free of stale or already-guarded routes', () => {
    for (const file of Object.keys(exempt)) {
      expect(existsSync(join(API, file)), file).toBe(true)
      expect(GUARD.test(readFileSync(join(API, file), 'utf8')), file).toBe(false)
    }
  })
})
