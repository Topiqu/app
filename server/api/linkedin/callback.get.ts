import { verifyOAuthState } from '../../utils/linkedin/oauthState'
import { getAccessToken, getPersonalUrn, getPagesUrn } from '../../utils/linkedin/api'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  const db = await getEnhancedPrisma(user)

  // This handler runs on APP_URL's host, settings live on the tenant's own domain, and `strategy: 'prefix'`
  // leaves no unprefixed route — so a relative `/settings` redirect lands on a 404 of the wrong site.
  const settingsUrl = async (clientSiteId: string | undefined, outcome: string, locale: 'cs' | 'en' = 'en') => {
    const site = clientSiteId
      ? await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { domain: true } })
      : null
    const origin = site?.domain ? `https://${site.domain}` : ''
    return `${origin}/${locale}/settings?tab=integrations&linkedin=${outcome}`
  }

  const query = getQuery(event)
  const state = typeof query.state === 'string' ? query.state : undefined
  const savedState = takeOAuthState(event, 'linkedin_oauth_state')
  const payload = state && state === savedState ? verifyOAuthState(state) : null

  if (query.error) {
    console.warn('LinkedIn connect declined at LinkedIn:', query.error, query.error_description)
    return sendRedirect(event, await settingsUrl(payload?.clientSiteId ?? user.clientSiteId, 'error', payload?.locale))
  }

  if (!payload) {
    // Four different failures used to share one opaque message, so a broken connect left no trail.
    const reason = !state
      ? 'no state on the callback'
      : !savedState
        ? 'state cookie missing — expired, or set on a host that does not reach this callback'
        : state !== savedState
          ? 'state cookie does not match the callback state'
          : 'state signature or payload rejected'
    console.warn(`LinkedIn callback rejected: ${reason}`, { userId: user.id })
    return sendRedirect(event, await settingsUrl(user.clientSiteId, 'invalid-state'))
  }

  const { clientSiteId, appType, locale } = payload

  if (user.role !== 'superadmin' && clientSiteId !== user.clientSiteId) {
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', clientSiteId)

  const code = typeof query.code === 'string' ? query.code : undefined
  if (!code) {
    console.warn('LinkedIn callback carried a valid state but no code', { clientSiteId })
    return sendRedirect(event, await settingsUrl(clientSiteId, 'error', locale))
  }

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

    return sendRedirect(event, await settingsUrl(clientSiteId, 'connected', locale))
  } catch (err: any) {
    console.error('LinkedIn token exchange failed', { clientSiteId, message: err?.message })
    throw createError({ statusCode: 500, message: `Failed to connect LinkedIn: ${err.message}` })
  }
})
