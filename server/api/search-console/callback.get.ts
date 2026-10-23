export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseHeader(event, 'referrer-policy', 'no-referrer')
  const { data, user } = await consumeIntegrationOAuth(event, 'search-console')
  const query = getQuery(event)
  const site = await requireSearchConsoleEligibility(data.tenantId)
  const settingsUrl = (outcome: string) => integrationSettingsUrl(data, outcome)

  if (query.error || typeof query.code !== 'string') return sendRedirect(event, settingsUrl('cancelled'))

  try {
    const tokens = await exchangeSearchConsoleCode(query.code, searchConsoleRedirectUri())
    if (!tokens.refresh_token)
      throw createError({
        statusCode: 400,
        message: 'Google did not return offline access. Revoke Topiqu access and try again.',
      })
    const [identity, sites] = await Promise.all([
      getGoogleIdentity(tokens.access_token),
      listSearchConsoleSites(tokens.access_token),
    ])
    const property = chooseSearchConsoleProperty(site.domain, sites)

    await requireIntegrationActor(event, data)
    await requireSearchConsoleEligibility(data.tenantId)
    const db = await getEnhancedPrisma(user)
    await db.searchConsoleConnection.upsert({
      where: { clientSiteId: data.tenantId },
      create: {
        clientSiteId: data.tenantId,
        googleSubjectId: identity.sub,
        googleEmail: identity.email,
        encryptedRefreshToken: encryptSearchConsoleToken(tokens.refresh_token),
        grantedScopes: tokens.scope.split(' '),
        propertyUrl: property?.siteUrl,
        permissionLevel: property?.permissionLevel,
      },
      update: {
        googleSubjectId: identity.sub,
        googleEmail: identity.email,
        encryptedRefreshToken: encryptSearchConsoleToken(tokens.refresh_token),
        grantedScopes: tokens.scope.split(' '),
        propertyUrl: property?.siteUrl,
        permissionLevel: property?.permissionLevel,
        status: 'CONNECTED',
        lastError: null,
        lastErrorAt: null,
      },
    })
    return sendRedirect(event, settingsUrl(property ? 'connected' : 'select-property'))
  } catch {
    await reportCaughtError(
      'Search Console connection failed',
      new Error('Search Console OAuth exchange or persistence failed'),
      { clientSiteId: data.tenantId },
    )
    return sendRedirect(event, settingsUrl('error'))
  }
})
