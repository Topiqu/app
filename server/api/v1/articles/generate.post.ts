export default defineEventHandler(async (event) => {
  const { key } = await requireApiKey(event, 'GENERATE')
  const input = await readValidatedBody(event, apiGenerationSchema.parse)
  await actAsApiKeyMember(event, key)
  await requireTenantScope(event, 'AI_USE')
  await requireTenantScope(event, 'ARTICLE_WRITE')
  setResponseHeader(event, 'X-API-Version', '1')

  return withIdempotency(
    event,
    key,
    input,
    async () => {
      await assertApiGenerationCapacity(key.clientSiteId)
      const generation = await prisma.apiGeneration.create({
        data: {
          clientSiteId: key.clientSiteId,
          apiKeyId: key.id,
          topic: input.topic,
          instructions: input.instructions || null,
        },
        select: API_GENERATION_VIEW,
      })
      await logApiAction(event, key, 'API_GENERATION_REQUESTED', { generationId: generation.id })
      setResponseStatus(event, 202)
      setResponseHeader(event, 'Location', `/api/v1/generations/${generation.id}`)
      return { data: serializeApiGeneration(generation) }
    },
    // A retried request must not queue, and pay for, a second article.
    { required: true },
  )
})
