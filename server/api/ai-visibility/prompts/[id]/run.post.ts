export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing prompt ID' })
  const prompt = await db.aiVisibilityPrompt.findUnique({
    where: { id },
    select: { id: true, clientSiteId: true, clientSite: { select: { plan: true } } },
  })
  if (!prompt || prompt.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 404, message: 'Prompt not found' })
  if (!['PREMIUM', 'CUSTOM'].includes(prompt.clientSite.plan))
    throw createError({ statusCode: 403, message: 'AI visibility monitoring requires Premium' })

  const result = await runVisibilityPrompt(prompt.id, user.id)
  // Provider errors (quota, billing, raw response bodies) stay in the run row and the logs.
  if (result.status === 'failed') {
    const { translate: t } = await useServerI18n(event)
    throw createError({ statusCode: 502, message: t('visibility.messages.failed') })
  }
  if (result.status === 'skipped')
    throw createError({
      statusCode: result.reason === 'no_configured_providers' ? 503 : 409,
      message:
        result.reason === 'no_configured_providers'
          ? 'No AI visibility provider is configured'
          : 'Prompt is inactive or already running',
    })
  return {
    ...result,
    providers: result.providers.map((outcome) =>
      outcome.status === 'failed'
        ? { status: outcome.status, runId: outcome.runId, provider: outcome.provider, model: outcome.model }
        : outcome,
    ),
  }
})
