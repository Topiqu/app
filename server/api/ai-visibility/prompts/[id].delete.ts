export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { clientSite: true })
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing prompt ID' })
  const prompt = await db.aiVisibilityPrompt.findUnique({ where: { id }, select: { id: true, clientSiteId: true } })
  if (!prompt || prompt.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 404, message: 'Prompt not found' })
  await db.aiVisibilityPrompt.delete({ where: { id } })
  await logAction({
    action: 'AI_VISIBILITY_PROMPT_DELETED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    metadata: { promptId: id },
  })
  return { success: true }
})
