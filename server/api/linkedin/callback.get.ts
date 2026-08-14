import { verifyOAuthState } from '../../utils/linkedin/oauthState'
import { getLinkedInRedirectUri } from '../../utils/linkedin/redirectUri'
import { getAccessToken, getPersonalUrn, getPagesUrn } from '../../utils/linkedin/api'

const settingsRedirect = '/settings?tab=integrations'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  const query = getQuery(event)
  if (query.error) {
    return sendRedirect(event, `${settingsRedirect}&linkedin=error`)
  }

  const code = query.code as string | undefined
  const state = query.state as string | undefined
  const savedState = getCookie(event, 'linkedin_oauth_state')
  deleteCookie(event, 'linkedin_oauth_state')

  if (!code || !state || !savedState || state !== savedState) {
    throw createError({ statusCode: 400, message: 'Invalid OAuth state' })
  }

  const payload = verifyOAuthState(state)
  if (!payload) {
    throw createError({ statusCode: 400, message: 'Invalid OAuth state' })
  }

  const { clientSiteId, appType } = payload

  if (user.role !== 'superadmin' && clientSiteId !== user.clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', clientSiteId)

  const clientId =
    appType === 'pages' ? process.env.LINKEDIN_CLIENT_ID_COMPANY : process.env.LINKEDIN_CLIENT_ID_PERSONAL
  const clientSecret =
    appType === 'pages' ? process.env.LINKEDIN_CLIENT_SECRET_COMPANY : process.env.LINKEDIN_CLIENT_SECRET_PERSONAL
  if (!clientId || !clientSecret) {
    throw createError({ statusCode: 500, message: 'LinkedIn credentials not configured' })
  }

  const redirectUri = getLinkedInRedirectUri()

  try {
    const tokenData = await getAccessToken(code, redirectUri, clientId, clientSecret)
    const accessToken = tokenData.access_token

    const fetchedUrn = appType === 'personal' ? await getPersonalUrn(accessToken) : await getPagesUrn(accessToken)

    const db = await getEnhancedPrisma(user)
    const company = await db.linkedinCompany.findFirst({ where: { clientSiteId, type: appType } })

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
      await db.linkedinCompany.create({ data: dbData })
    } else {
      await db.linkedinCompany.update({ where: { id: company.id }, data: dbData })
    }

    return sendRedirect(event, `${settingsRedirect}&linkedin=connected`)
  } catch (err: any) {
    throw createError({ statusCode: 500, message: `Failed to connect LinkedIn: ${err.message}` })
  }
})
