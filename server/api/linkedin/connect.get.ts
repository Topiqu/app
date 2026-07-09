import { randomUUID } from 'node:crypto'

import { signOAuthState } from '../../utils/linkedin/oauthState'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  const query = getQuery(event)
  const appType = query.appType === 'pages' ? 'pages' : 'personal'

  const requestedClientSiteId = query.clientSiteId as string | undefined
  const clientSiteId =
    user.role === 'superadmin' && requestedClientSiteId ? requestedClientSiteId : user.clientSiteId

  if (!clientSiteId) {
    throw createError({ statusCode: 400, message: 'Missing clientSiteId' })
  }

  const clientId =
    appType === 'pages'
      ? process.env.LINKEDIN_CLIENT_ID_COMPANY
      : process.env.LINKEDIN_CLIENT_ID_PERSONAL
  if (!clientId) {
    throw createError({ statusCode: 500, message: `LinkedIn ${appType} Client ID not configured` })
  }

  const config = useRuntimeConfig()
  const redirectUri = config.public.siteUrl
    ? `${config.public.siteUrl}/api/linkedin/callback`
    : 'http://localhost:3000/api/linkedin/callback'

  const state = signOAuthState({ nonce: randomUUID(), clientSiteId, appType })

  setCookie(event, 'linkedin_oauth_state', state, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  })

  const scope =
    appType === 'pages'
      ? 'w_organization_social r_organization_social rw_organization_admin'
      : 'openid profile email w_member_social'

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`

  return sendRedirect(event, authUrl)
})
