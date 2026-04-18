export default defineEventHandler((event) => {
  const query = getQuery(event)
  const appType = (query.appType as string) || 'personal'
  const clientSiteId = query.clientSiteId as string

  if (!clientSiteId) {
    throw createError({ statusCode: 400, message: 'Missing clientSiteId' })
  }

  const config = useRuntimeConfig()
  let clientId

  if (appType === 'pages') {
    clientId = process.env.LINKEDIN_CLIENT_ID_COMPANY
  } else {
    clientId = process.env.LINKEDIN_CLIENT_ID_PERSONAL
  }

  if (!clientId) {
    throw createError({ statusCode: 500, message: `LinkedIn ${appType} Client ID not configured` })
  }

  const redirectUri = config.public.siteUrl
    ? `${config.public.siteUrl}/api/linkedin/callback`
    : 'http://localhost:3000/api/linkedin/callback'

  // Generate a secure hash to prevent CSRF
  const csrfHash = Math.random().toString(36).substring(7)
  const state = `${appType}|${clientSiteId}|${csrfHash}`

  // Store the hash in a cookie
  setCookie(event, 'linkedin_oauth_hash', csrfHash, { httpOnly: true, maxAge: 300 })

  // LinkedIn OAuth 2.0 authorization URL
  const scope =
    appType === 'pages'
      ? 'w_organization_social r_organization_social rw_organization_admin' // typical scopes for pages
      : 'openid profile email w_member_social' // scopes for personal (OpenID Connect + Share)

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`

  return sendRedirect(event, authUrl)
})
