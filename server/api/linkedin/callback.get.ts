export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'referrer-policy', 'no-referrer')
  const { data, user } = await consumeIntegrationOAuth(event, 'linkedin')
  const query = getQuery(event)
  if (query.error || typeof query.code !== 'string')
    return sendRedirect(event, integrationSettingsUrl(data, 'cancelled'))

  const clientId = process.env.LINKEDIN_CLIENT_ID_PERSONAL
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET_PERSONAL
  if (!clientId || !clientSecret) throw createError({ statusCode: 503 })
  const db = await getEnhancedPrisma(user)
  try {
    const tokenData = await getAccessToken(query.code, getLinkedInRedirectUri(), clientId, clientSecret)
    const linkedinOrgId = await getPersonalUrn(tokenData.access_token)
    // Recheck after the provider round trip, before persisting any credentials.
    await requireIntegrationActor(event, data)
    const company = await db.linkedinCompany.findFirst({
      where: { clientSiteId: data.tenantId, type: 'personal' },
      select: { id: true },
    })
    const dbData = {
      name: 'Connected Personal Profile',
      linkedinOrgId,
      clientSiteId: data.tenantId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      type: 'personal',
    }
    if (company) await db.linkedinCompany.update({ where: { id: company.id }, data: dbData })
    else await db.linkedinCompany.create({ data: dbData })
    return sendRedirect(event, integrationSettingsUrl(data, 'connected'))
  } catch {
    // Provider errors may embed authorization codes or tokens in their URL/body.
    await reportCaughtError('LinkedIn connection failed', new Error('LinkedIn OAuth exchange or persistence failed'), {
      clientSiteId: data.tenantId,
    })
    return sendRedirect(event, integrationSettingsUrl(data, 'error'))
  }
})
