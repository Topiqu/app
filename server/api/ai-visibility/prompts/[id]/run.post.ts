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

  const result = await withTokenReservation(
    prompt.clientSiteId,
    2500,
    'AI_VISIBILITY',
    () => runVisibilityPrompt(prompt.id, user.id),
    tokenRequestKey(event, prompt.clientSiteId, 'AI_VISIBILITY'),
  )
  if (result.status === 'failed') throw createError({ statusCode: 502, message: result.error })
  if (result.status === 'skipped') throw createError({ statusCode: 409, message: 'Prompt is inactive or already running' })
  return result
})
