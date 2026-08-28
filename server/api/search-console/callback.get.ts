import { encryptSearchConsoleToken } from '../../utils/searchConsole/crypto'
import { verifySearchConsoleState } from '../../utils/searchConsole/oauthState'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'] })
  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : undefined
  const saved = takeOAuthState(event, 'gsc_oauth_state')
  const payload = state && saved === state ? verifySearchConsoleState(state) : null
  if (!payload) {
    const reason = !state
      ? 'no state on the callback'
      : !saved
        ? 'state cookie missing — expired, or set on a host that does not reach this callback'
        : saved !== state
          ? 'state cookie does not match the callback state'
          : 'state signature or expiry rejected'
    console.warn(`Search Console callback rejected: ${reason}`, { userId: user.id })
    throw createError({ statusCode: 403, message: 'Invalid Search Console OAuth state' })
  }
  if (user.role !== 'superadmin' && user.clientSiteId !== payload.clientSiteId)
    throw createError({ statusCode: 403, message: 'Invalid Search Console OAuth state' })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', payload.clientSiteId)

  const site = await prisma.clientSite.findUnique({
    where: { id: payload.clientSiteId },
    select: {
      domain: true,
      plan: true,
      features: { where: { isActive: true, feature: { code: 'SEARCH_CONSOLE' } }, select: { id: true }, take: 1 },
    },
  })
  if (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan) || !site.features.length)
    throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })

  // The callback lands on AUTH_ORIGIN's host, settings live on the tenant's; `strategy: 'prefix'` also
  // means an unprefixed `/settings` has no route at all.
  const settingsUrl = (outcome: string) =>
    `https://${site.domain}/${payload.locale ?? 'en'}/settings?tab=integrations&gsc=${outcome}`

  if (typeof query.code !== 'string') return sendRedirect(event, settingsUrl('cancelled'))

  const tokens = await exchangeSearchConsoleCode(query.code, searchConsoleRedirectUri())
  if (!tokens.refresh_token)
    throw createError({
      statusCode: 400,
      message: 'Google did not return offline access. Revoke Topiqu access and try again.',
    })
  const [identity, sites] = await Promise.all([
    getGoogleIdentity(tokens.access_token),
    listSearchConsoleSites(tokens.access_token),
  ])
  const property = chooseSearchConsoleProperty(site.domain, sites)

  await prisma.searchConsoleConnection.upsert({
    where: { clientSiteId: payload.clientSiteId },
    create: {
      clientSiteId: payload.clientSiteId,
      googleSubjectId: identity.sub,
      googleEmail: identity.email,
      encryptedRefreshToken: encryptSearchConsoleToken(tokens.refresh_token),
      grantedScopes: tokens.scope.split(' '),
      propertyUrl: property?.siteUrl,
      permissionLevel: property?.permissionLevel,
    },
    update: {
      googleSubjectId: identity.sub,
      googleEmail: identity.email,
      encryptedRefreshToken: encryptSearchConsoleToken(tokens.refresh_token),
      grantedScopes: tokens.scope.split(' '),
      propertyUrl: property?.siteUrl,
      permissionLevel: property?.permissionLevel,
      status: 'CONNECTED',
      lastError: null,
      lastErrorAt: null,
    },
  })
  return sendRedirect(event, settingsUrl(property ? 'connected' : 'select-property'))
})
