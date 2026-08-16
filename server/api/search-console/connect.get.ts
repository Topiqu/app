import { randomUUID } from 'node:crypto'

import { signSearchConsoleState } from '../../utils/searchConsole/oauthState'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', clientSiteId)
  const site = await prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } })
  if (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan))
    throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  const clientId = searchConsoleClientId()
  if (!clientId) throw createError({ statusCode: 503, message: 'Google Search Console OAuth is not configured' })

  const state = signSearchConsoleState({ clientSiteId, nonce: randomUUID(), exp: Date.now() + 10 * 60_000 })
  setCookie(event, 'gsc_oauth_state', state, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: searchConsoleRedirectUri(),
    response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return sendRedirect(event, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})
