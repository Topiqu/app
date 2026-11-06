export default defineEventHandler(async (event) => {
  const { user, clientSiteId } = await requireArticleBatchAccess(event)
  await ensureMinAccountAge(event, user.id)
  if (!(await consumeRateLimit(`article-batch-proposal:${user.id}`, 20, 3600))) throw createError({ statusCode: 429 })

  const { id, missing } = await proposeArticleBatch(clientSiteId, user.id)
  if (missing) event.waitUntil(topUpArticleBatchProposal(id, clientSiteId, missing))
  return { id }
})
