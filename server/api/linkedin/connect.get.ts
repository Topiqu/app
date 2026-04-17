export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const clientId = config.linkedinClientId || process.env.LINKEDIN_CLIENT_ID
  const redirectUri = config.public.siteUrl
    ? `${config.public.siteUrl}/api/linkedin/callback`
    : 'http://localhost:3000/api/linkedin/callback'

  if (!clientId) {
    throw createError({ statusCode: 500, message: 'LinkedIn Client ID not configured' })
  }

  // Generate a random state string to prevent CSRF
  const state = Math.random().toString(36).substring(7)

  // Store state in a cookie or session to verify later
  setCookie(event, 'linkedin_oauth_state', state, { httpOnly: true, maxAge: 300 })

  // LinkedIn OAuth 2.0 authorization URL
  const scope = 'w_member_social r_liteprofile' // Adjust scopes as needed for UGC Posts and pages
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`

  return sendRedirect(event, authUrl)
})
