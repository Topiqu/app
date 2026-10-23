import type { H3Event } from 'h3'

import { z } from 'zod'

export const INTEGRATION_OAUTH_IDENTIFIER = 'integration-oauth'
export const integrationProviderSchema = z.enum(['linkedin', 'search-console'])
export const integrationRequestSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const ticketSchema = z.object({
  provider: integrationProviderSchema,
  actorId: z.string(),
  sourceSessionId: z.string(),
  tenantId: z.string(),
  origin: z.url(),
  locale: z.enum(['cs', 'en', 'de', 'fr']),
  platformAdmin: z.boolean(),
  stateHash: z.string().length(64).optional(),
})
type IntegrationTicket = z.infer<typeof ticketSchema>

/** A tenant host may only send the browser back to that same verified tenant. */
export const requireIntegrationOrigin = async (origin: string, tenantId: string) => {
  const url = new URL(origin)
  const central = new URL(centralAuthOrigin())
  if (
    url.origin !== origin ||
    !['https:', 'http:'].includes(url.protocol) ||
    (isSecureAuth && url.protocol !== 'https:')
  )
    throw createError({ statusCode: 403 })
  // Platform roots can administer the selected tenant without serving its publication.
  // Match the configured central protocol/port; other managed tenant hosts still need equality.
  const platformOrigin =
    origin === central.origin ||
    (isRootHost(url.hostname, process.env.BASE_DOMAIN || 'topiqu.com') &&
      url.protocol === central.protocol &&
      url.port === central.port)
  const site = await prisma.clientSite.findFirst({
    where: {
      id: tenantId,
      deletedAt: null,
      ...(platformOrigin ? {} : { domain: url.hostname, domainVerified: true }),
    },
    select: { id: true, domain: true },
  })
  if (!site) throw createError({ statusCode: 403 })
  return site
}

export const requireIntegrationAccess = async (event: H3Event, tenantId: string, platformAdmin = false) => {
  const { user, membership } = await requireTenantScope(event, 'INTEGRATION_CONTROL', tenantId)
  // requireTenantScope deliberately supports platform administrators. A request originating on a
  // customer host must prove real membership, even when its account is a platform administrator.
  if (user.role === 'superadmin' && !platformAdmin) {
    const actual = await prisma.tenantMembership.findUnique({
      where: { clientSiteId_userId: { clientSiteId: tenantId, userId: user.id } },
      select: { role: true, scopes: true, deletedAt: true, clientSite: { select: { deletedAt: true } } },
    })
    if (
      !actual ||
      actual.deletedAt ||
      actual.clientSite.deletedAt ||
      (actual.role !== 'OWNER' && !actual.scopes.includes('INTEGRATION_CONTROL'))
    )
      throw createError({ statusCode: 403 })
    return { ...user, role: 'admin' as const, clientSiteId: tenantId, scopes: actual.scopes }
  }
  // Authorization is against the ticket's tenant, independently of the central session's selection.
  return {
    ...user,
    clientSiteId: tenantId,
    role: user.role === 'superadmin' ? ('superadmin' as const) : ('admin' as const),
    scopes: membership.scopes,
  }
}

export const createIntegrationTicket = async (
  event: H3Event,
  provider: IntegrationTicket['provider'],
  tenantId?: string,
  locale?: unknown,
) => {
  const session = await requireUser(event)
  const origin = authTransferOrigin(event)
  const platformAdmin = origin === centralAuthOrigin() && session.role === 'superadmin'
  const target = platformAdmin && tenantId ? tenantId : session.clientSiteId
  if (!target || (tenantId && tenantId !== target)) throw createError({ statusCode: 403 })
  const actor = await requireIntegrationAccess(event, target, platformAdmin)
  await requireIntegrationOrigin(origin, target)
  if (!(await consumeRateLimit(`integration-start:${actor.id}`, 10, 600))) throw createError({ statusCode: 429 })
  const expired = await prisma.verification.findMany({
    where: { identifier: INTEGRATION_OAUTH_IDENTIFIER, expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  })
  if (expired.length)
    await prisma.verification.deleteMany({
      where: {
        id: { in: expired.map((entry) => entry.id) },
        identifier: INTEGRATION_OAUTH_IDENTIFIER,
        expiresAt: { lt: new Date() },
      },
    })
  const request = authTransferSecret()
  const cookieLocale = getCookie(event, 'i18n_lang')
  const data: IntegrationTicket = {
    provider,
    actorId: actor.id,
    sourceSessionId: actor.sessionId,
    tenantId: target,
    origin,
    locale: isLanguage(locale) ? locale : isLanguage(cookieLocale) ? cookieLocale : (actor.language ?? 'en'),
    platformAdmin,
  }
  await prisma.verification.create({
    data: {
      id: authTransferHash(request),
      identifier: INTEGRATION_OAUTH_IDENTIFIER,
      value: JSON.stringify(data),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  })
  const url = new URL(`/${data.locale}/integrations-connect`, centralAuthOrigin())
  url.searchParams.set('request', request)
  return { url: url.href }
}

export const loadIntegrationTicket = async (request: string) => {
  integrationRequestSchema.parse(request)
  const row = await prisma.verification.findFirst({
    where: { id: authTransferHash(request), identifier: INTEGRATION_OAUTH_IDENTIFIER, expiresAt: { gt: new Date() } },
    select: { id: true, value: true },
  })
  if (!row) throw createError({ statusCode: 400 })
  const data = ticketSchema.parse(JSON.parse(row.value))
  await requireIntegrationOrigin(data.origin, data.tenantId)
  return { row, data }
}

export const integrationSettingsUrl = (data: IntegrationTicket, outcome: string) => {
  const url = new URL(`/${data.locale}/settings`, data.origin)
  url.searchParams.set('tab', 'integrations')
  url.searchParams.set(data.provider === 'linkedin' ? 'linkedin' : 'gsc', outcome)
  return url.href
}

export const requireIntegrationActor = async (event: H3Event, data: IntegrationTicket): Promise<SessionUser> => {
  const user = await requireUser(event)
  if (user.id !== data.actorId) throw createError({ statusCode: 403 })
  const source = await prisma.session.findFirst({
    where: { id: data.sourceSessionId, userId: data.actorId, expiresAt: { gt: new Date() }, user: { deletedAt: null } },
    select: { id: true },
  })
  if (!source) throw createError({ statusCode: 403 })
  return requireIntegrationAccess(event, data.tenantId, data.platformAdmin)
}

export const integrationOAuthUrl = (provider: IntegrationTicket['provider'], state: string) => {
  const redirectUri = provider === 'linkedin' ? getLinkedInRedirectUri() : searchConsoleRedirectUri()
  if (new URL(redirectUri).origin !== centralAuthOrigin()) throw createError({ statusCode: 503 })
  const clientId = provider === 'linkedin' ? process.env.LINKEDIN_CLIENT_ID_PERSONAL : searchConsoleClientId()
  if (!clientId) throw createError({ statusCode: 503 })
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope:
      provider === 'linkedin'
        ? 'openid profile email w_member_social'
        : 'openid email https://www.googleapis.com/auth/webmasters.readonly',
  })
  if (provider === 'search-console') {
    params.set('access_type', 'offline')
    params.set('prompt', 'consent')
  }
  return `${provider === 'linkedin' ? 'https://www.linkedin.com/oauth/v2/authorization' : 'https://accounts.google.com/o/oauth2/v2/auth'}?${params}`
}

/** Cookie equality and a server-side atomic consume protect CSRF, callback races and replay. */
export const consumeIntegrationOAuth = async (event: H3Event, provider: IntegrationTicket['provider']) => {
  requireCentralAuth(event)
  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : ''
  const saved = takeOAuthState(event, provider === 'linkedin' ? 'linkedin_oauth_state' : 'gsc_oauth_state')
  const [request, secret, extra] = state.split('.')
  if (!saved || saved !== state || !request || !secret || extra) throw createError({ statusCode: 403 })
  const { row, data } = await loadIntegrationTicket(request)
  if (data.provider !== provider || data.stateHash !== authTransferHash(secret)) throw createError({ statusCode: 403 })
  const user = await requireIntegrationActor(event, data)
  if (!(await consumeRateLimit(`integration-callback:${user.id}`, 10, 600))) throw createError({ statusCode: 429 })
  const consumed = await prisma.verification.deleteMany({
    where: { id: row.id, identifier: INTEGRATION_OAUTH_IDENTIFIER, value: row.value, expiresAt: { gt: new Date() } },
  })
  if (consumed.count !== 1) throw createError({ statusCode: 403 })
  return { data, user }
}
