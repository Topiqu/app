import { encryptSearchConsoleToken } from '../../utils/searchConsole/crypto'
import { verifySearchConsoleState } from '../../utils/searchConsole/oauthState'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'] })
  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : undefined
  const saved = getCookie(event, 'gsc_oauth_state')
  deleteCookie(event, 'gsc_oauth_state', { path: '/' })
  const payload = state && saved === state ? verifySearchConsoleState(state) : null
  if (!payload || (user.role !== 'superadmin' && user.clientSiteId !== payload.clientSiteId)) throw createError({ statusCode: 403, message: 'Invalid Search Console OAuth state' })
  if (typeof query.code !== 'string') return sendRedirect(event, '/settings?tab=integrations&gsc=cancelled')

  const site = await prisma.clientSite.findUnique({ where: { id: payload.clientSiteId }, select: { domain: true, plan: true } })
  if (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan)) throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  const tokens = await exchangeSearchConsoleCode(query.code, searchConsoleRedirectUri())
  if (!tokens.refresh_token) throw createError({ statusCode: 400, message: 'Google did not return offline access. Revoke Topiqu access and try again.' })
  const [identity, sites] = await Promise.all([getGoogleIdentity(tokens.access_token), listSearchConsoleSites(tokens.access_token)])
  const property = chooseSearchConsoleProperty(site.domain, sites)

  await prisma.searchConsoleConnection.upsert({
    where: { clientSiteId: payload.clientSiteId },
    create: { clientSiteId: payload.clientSiteId, googleSubjectId: identity.sub, googleEmail: identity.email, encryptedRefreshToken: encryptSearchConsoleToken(tokens.refresh_token), grantedScopes: tokens.scope.split(' '), propertyUrl: property?.siteUrl, permissionLevel: property?.permissionLevel },
    update: { googleSubjectId: identity.sub, googleEmail: identity.email, encryptedRefreshToken: encryptSearchConsoleToken(tokens.refresh_token), grantedScopes: tokens.scope.split(' '), propertyUrl: property?.siteUrl, permissionLevel: property?.permissionLevel, status: 'CONNECTED', lastError: null, lastErrorAt: null },
  })
  return sendRedirect(event, `/settings?tab=integrations&gsc=${property ? 'connected' : 'select-property'}`)
})
