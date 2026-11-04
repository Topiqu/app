import type { ApiGenerationStatus } from '~~/generated/zenstack/models'

/** Queued plus running per site: the queue is a request line, not a bulk import. */
export const MAX_PENDING_API_GENERATIONS = 5
/** A run that outlives this was lost with its worker; its reservation expires on its own. */
export const API_GENERATION_TIMEOUT_MS = 45 * 60_000

/** A queued request must still have its key, member permissions and paid seat when work starts. */
export const requireApiGenerationAccess = async (apiKeyId: string | null, clientSiteId: string) => {
  const key = apiKeyId
    ? await prisma.apiKey.findFirst({
        where: { id: apiKeyId, clientSiteId, deletedAt: null, revokedAt: null, clientSite: { deletedAt: null } },
        select: {
          id: true,
          clientSiteId: true,
          scopes: true,
          createdById: true,
          clientSite: { select: { plan: true } },
        },
      })
    : null
  if (!key || !key.scopes.includes('GENERATE'))
    throw createError({ statusCode: 403, message: 'The API key no longer permits generation' })
  const { scopes } = await apiKeyCreatorAccess({ ...key, plan: key.clientSite.plan })
  if (!scopes.includes('AI_USE') || !scopes.includes('ARTICLE_WRITE'))
    throw createError({ statusCode: 403, message: 'The key creator no longer permits article generation' })
}

export const API_GENERATION_VIEW = {
  id: true,
  topic: true,
  status: true,
  articleId: true,
  error: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} as const

export const serializeApiGeneration = (generation: {
  id: string
  topic: string
  status: ApiGenerationStatus
  articleId: string | null
  error: string | null
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}) => ({
  id: generation.id,
  topic: generation.topic,
  status: generation.status.toLowerCase() as Lowercase<ApiGenerationStatus>,
  articleId: generation.articleId,
  error: generation.error,
  createdAt: generation.createdAt.toISOString(),
  startedAt: generation.startedAt?.toISOString() ?? null,
  finishedAt: generation.finishedAt?.toISOString() ?? null,
})

/**
 * Credits are reserved only when the task picks a request up, so the queue checks them up front: every pending
 * request of the site is counted as already spent.
 */
export const assertApiGenerationCapacity = async (clientSiteId: string) => {
  const site = await prisma.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { plan: true, articleQuality: true },
  })
  if (!hasAiPlan(site.plan)) throw createError({ statusCode: 403, message: 'Article generation is not in this plan' })

  const pending = await prisma.apiGeneration.count({
    where: { clientSiteId, status: { in: ['QUEUED', 'RUNNING'] } },
  })
  if (pending >= MAX_PENDING_API_GENERATIONS)
    throw createError({
      statusCode: 429,
      message: `At most ${MAX_PENDING_API_GENERATIONS} generations can be queued or running`,
    })

  const cost = articleCreditCost(articleQualityOf(site.articleQuality))
  // A running request already holds its reservation in the wallet; only queued ones are not counted there yet.
  const queued = await prisma.apiGeneration.count({ where: { clientSiteId, status: 'QUEUED' } })
  const { available } = await getArticleCreditWallet(clientSiteId)
  const required = cost * (queued + 1)
  if (available < required)
    throw createError({
      statusCode: 402,
      message: 'Insufficient article credits',
      data: { required, available },
    })
}
