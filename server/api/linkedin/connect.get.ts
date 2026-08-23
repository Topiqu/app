import { randomUUID } from 'node:crypto'

import { signOAuthState } from '../../utils/linkedin/oauthState'
import { getLinkedInRedirectUri } from '../../utils/linkedin/redirectUri'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', user.clientSiteId)

  const query = getQuery(event)

  // Company Pages ride on LinkedIn's Community Management API, approved only for registered legal
  // entities. Personal is the only connectable type until that clears; the `pages` plumbing
  // (token.ts, callback, LinkedinCompany.type) stays put so re-enabling is a revert.
  if (query.appType === 'pages') {
    throw createError({ statusCode: 403, message: 'LinkedIn Company Pages are not available yet.' })
  }

  const requestedClientSiteId = query.clientSiteId as string | undefined
  const clientSiteId = user.role === 'superadmin' && requestedClientSiteId ? requestedClientSiteId : user.clientSiteId

  if (!clientSiteId) {
    throw createError({ statusCode: 400, message: 'Missing clientSiteId' })
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID_PERSONAL
  if (!clientId) {
    throw createError({ statusCode: 500, message: 'LinkedIn personal Client ID not configured' })
  }

  const redirectUri = getLinkedInRedirectUri()

  const state = signOAuthState({
    nonce: randomUUID(),
    clientSiteId,
    appType: 'personal',
    locale: getCookie(event, 'i18n_lang') === 'cs' ? 'cs' : 'en',
  })

  setOAuthState(event, 'linkedin_oauth_state', state, 300)

  const scope = 'openid profile email w_member_social'

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`

  return sendRedirect(event, authUrl)
})
