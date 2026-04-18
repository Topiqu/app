import prisma from '../../utils/prisma'
import { getAccessToken, getPersonalUrn, getPagesUrn } from '../../utils/linkedin/api'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string
  const state = query.state as string
  const error = query.error as string

  if (error) {
    return `LinkedIn Auth Error: ${error}`
  }

  const [appType, clientSiteId, csrfHash] = state.split('|')

  const savedHash = getCookie(event, 'linkedin_oauth_hash')
  if (csrfHash !== savedHash) {
    throw createError({ statusCode: 400, message: 'Invalid state parameter' })
  }

  if (!clientSiteId || !appType) {
    throw createError({ statusCode: 400, message: 'Chybí klientská data ve state' })
  }

  const config = useRuntimeConfig()
  let clientId, clientSecret

  if (appType === 'pages') {
    clientId = process.env.LINKEDIN_CLIENT_ID_COMPANY
    clientSecret = process.env.LINKEDIN_CLIENT_SECRET_COMPANY
  } else {
    clientId = process.env.LINKEDIN_CLIENT_ID_PERSONAL
    clientSecret = process.env.LINKEDIN_CLIENT_SECRET_PERSONAL
  }

  const redirectUri = config.public.siteUrl
    ? `${config.public.siteUrl}/api/linkedin/callback`
    : 'http://localhost:3000/api/linkedin/callback'

  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'LinkedIn credentials not configured' })
  }

  try {
    const tokenData = await getAccessToken(code, redirectUri, clientId, clientSecret)
    const accessToken = tokenData.access_token

    let fetchedUrn = ''
    if (appType === 'personal') {
      fetchedUrn = await getPersonalUrn(accessToken)
    } else {
      fetchedUrn = await getPagesUrn(accessToken)
    }

    const company = await prisma.linkedinCompany.findFirst({
      where: { clientSiteId, type: appType },
    })

    const dbData = {
      name: appType === 'pages' ? 'Connected LinkedIn Page' : 'Connected Personal Profile',
      linkedinOrgId: fetchedUrn,
      clientSiteId,
      accessToken,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      type: appType,
    }

    if (!company) {
      await prisma.linkedinCompany.create({ data: dbData })
    } else {
      await prisma.linkedinCompany.update({
        where: { id: company.id },
        data: dbData,
      })
    }

    return sendRedirect(event, '/master?tab=preferences')
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `Failed to connect LinkedIn: ${err.message}` })
  }
})
