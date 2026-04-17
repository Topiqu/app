import prisma from '../../utils/prisma'
import { getAccessToken } from '../../utils/linkedin/api'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string
  const state = query.state as string
  const error = query.error as string

  if (error) {
    return `LinkedIn Auth Error: ${error}`
  }

  const savedState = getCookie(event, 'linkedin_oauth_state')
  if (state !== savedState) {
    throw createError({ statusCode: 400, message: 'Invalid state parameter' })
  }

  const config = useRuntimeConfig()
  const clientId = config.linkedinClientId || process.env.LINKEDIN_CLIENT_ID
  const clientSecret = config.linkedinClientSecret || process.env.LINKEDIN_CLIENT_SECRET
  const redirectUri = config.public.siteUrl
    ? `${config.public.siteUrl}/api/linkedin/callback`
    : 'http://localhost:3000/api/linkedin/callback'

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'LinkedIn credentials not configured' })
  }

  try {
    const tokenData = await getAccessToken(code, redirectUri, clientId, clientSecret)

    // We get tokenData.access_token, tokenData.expires_in
    // Now fetch user info to get the URN (or org URN if needed)
    // Note: For company pages, you'll need the proper scope and API call.
    // For MVP, we'll assume the user authorizes and we save it.

    // For MVP, we'll just link it to the current active client site or session
    // Since we don't have the user's session in this simple callback (it's a redirect from LinkedIn),
    // ideally the state parameter contains the clientSiteId or userId.
    // Let's assume we put the clientSiteId in a cookie before redirecting, or pass it in state.

    const clientSiteId = getCookie(event, 'current_client_site_id')

    if (clientSiteId) {
      // Find or create LinkedinCompany for this client site
      let company = await prisma.linkedinCompany.findFirst({
        where: { clientSiteId },
      })

      if (!company) {
        company = await prisma.linkedinCompany.create({
          data: {
            name: 'Connected LinkedIn Account',
            linkedinOrgId: 'placeholder', // You would fetch the actual org ID from LinkedIn API
            clientSiteId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          },
        })
      } else {
        await prisma.linkedinCompany.update({
          where: { id: company.id },
          data: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          },
        })
      }
    }

    // Redirect back to preferences
    return sendRedirect(event, '/master?tab=preferences') // Adjust redirect to the actual preferences UI URL
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `Failed to connect LinkedIn: ${err.message}` })
  }
})
