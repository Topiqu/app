import { toHostname } from '~~/shared/utils/domain'
import { closestArticle, isOwnedDomain, mentionsBrand, normalizeCitationUrl } from '~~/shared/utils/aiVisibility'

import { configuredVisibilityProviderRuns, runVisibilityProvider } from './visibilityProviderRunner'

const SAMPLE_SIZE = 6
export const VISIBILITY_TOKEN_BUDGET = 15_000

const citationRows = (
  sources: readonly { sourceType: string; url?: string; title?: string }[],
  ownedDomain: string,
) => {
  const seen = new Set<string>()
  return sources.flatMap((source, position) => {
    if (source.sourceType !== 'url' || !source.url) return []
    const normalizedUrl = normalizeCitationUrl(source.url)
    if (!normalizedUrl || seen.has(normalizedUrl)) return []
    seen.add(normalizedUrl)
    const domain = toHostname(new URL(normalizedUrl).hostname)
    return [
      {
        url: source.url,
        normalizedUrl,
        domain,
        title: source.title?.slice(0, 500),
        owned: isOwnedDomain(domain, ownedDomain),
        position,
      },
    ]
  })
}

const citedArticle = (
  citation: { owned: boolean; normalizedUrl: string },
  articles: Array<{ id: string; slug: string; translations: Array<{ slug: string | null }> }>,
) => {
  if (!citation.owned) return null
  const slug = decodeURIComponent(new URL(citation.normalizedUrl).pathname.split('/').pop() ?? '').replace(/\.md$/, '')
  return articles.find(
    (article) => article.slug === slug || article.translations.some((translation) => translation.slug === slug),
  )?.id
}

const syncOpportunity = async (promptId: string, clientSiteId: string) => {
  const runs = await prisma.aiVisibilityRun.findMany({
    where: { promptId, clientSiteId, status: 'SUCCEEDED' },
    select: { id: true, citations: { select: { owned: true, domain: true } } },
    orderBy: { executedAt: 'desc' },
    take: SAMPLE_SIZE,
  })
  const sampleSize = runs.length
  const ownedHits = runs.filter((run) => run.citations.some((citation) => citation.owned)).length
  const externalHits = runs.filter((run) => run.citations.some((citation) => !citation.owned)).length
  const existing = await prisma.aiVisibilityOpportunity.findUnique({
    where: { clientSiteId_promptId: { clientSiteId, promptId } },
    select: { id: true, status: true },
  })

  if (ownedHits > 0) {
    if (existing?.status === 'OPEN')
      await prisma.aiVisibilityOpportunity.update({ where: { id: existing.id }, data: { status: 'RESOLVED' } })
    return
  }
  if (sampleSize < 2 || externalHits < 2) return

  const [prompt, articles] = await Promise.all([
    prisma.aiVisibilityPrompt.findUniqueOrThrow({ where: { id: promptId }, select: { text: true } }),
    prisma.article.findMany({
      where: { clientSiteId, status: 'published' },
      select: { id: true, title: true, excerpt: true },
      take: 250,
      orderBy: { publishedAt: 'desc' },
    }),
  ])
  const article = closestArticle(prompt.text, articles)
  const now = new Date()
  const citedDomains = [
    ...new Set(
      runs.flatMap((run) => run.citations.filter((citation) => !citation.owned).map((citation) => citation.domain)),
    ),
  ].slice(0, 10)

  await prisma.aiVisibilityOpportunity.upsert({
    where: { clientSiteId_promptId: { clientSiteId, promptId } },
    create: {
      clientSiteId,
      promptId,
      articleId: article?.id,
      kind: article ? 'UPDATE_ARTICLE' : 'CREATE_ARTICLE',
      reason: 'NO_OWNED_CITATION',
      citedDomains,
      sampleSize,
      ownedHits,
      externalHits,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      articleId: article?.id,
      kind: article ? 'UPDATE_ARTICLE' : 'CREATE_ARTICLE',
      status: existing?.status === 'DISMISSED' ? 'DISMISSED' : 'OPEN',
      reason: 'NO_OWNED_CITATION',
      citedDomains,
      sampleSize,
      ownedHits,
      externalHits,
      lastSeenAt: now,
    },
  })
}

export const runVisibilityPrompt = async (promptId: string, actorId?: string) => {
  const providers = configuredVisibilityProviderRuns()
  if (!providers.length) return { status: 'skipped' as const, reason: 'no_configured_providers' as const }

  const claimed = await prisma.$transaction(async (tx) => {
    const locks = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(hashtext(${promptId})) AS locked
    `
    if (!locks[0]?.locked) return null

    await tx.aiVisibilityRun.updateMany({
      where: { promptId, status: 'RUNNING', executedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      data: { status: 'FAILED', error: 'Visibility check timed out before completion' },
    })

    const prompt = await tx.aiVisibilityPrompt.findUnique({
      where: { id: promptId },
      include: { clientSite: { select: { id: true, name: true, domain: true, focus: true, audience: true } } },
    })
    if (!prompt?.active) return null
    const running = await tx.aiVisibilityRun.findFirst({
      where: { promptId, status: 'RUNNING', executedAt: { gte: new Date(Date.now() - 10 * 60_000) } },
      select: { id: true },
    })
    if (running) return null
    const runs = await Promise.all(
      providers.map(async (provider) => {
        const run = await tx.aiVisibilityRun.create({
          data: { promptId, clientSiteId: prompt.clientSiteId, provider: provider.provider, model: provider.model },
          select: { id: true },
        })
        return { ...provider, runId: run.id }
      }),
    )
    await tx.aiVisibilityPrompt.update({ where: { id: promptId }, data: { lastRunAt: new Date() } })
    return { prompt, runs }
  })

  if (!claimed) return { status: 'skipped' as const, reason: 'inactive_or_running' }
  const { prompt, runs } = claimed
  const articles = await prisma.article.findMany({
    where: { clientSiteId: prompt.clientSiteId, status: 'published' },
    select: { id: true, slug: true, translations: { select: { slug: true }, where: { status: 'PUBLISHED' } } },
  })
  const aliases = [prompt.clientSite.name, toHostname(prompt.clientSite.domain).split('.')[0] ?? '']

  const outcomes = await Promise.all(
    runs.map(async ({ runId, ...provider }) => {
      try {
        const result = await runVisibilityProvider(provider, prompt.text)
        const rows = citationRows(result.sources, prompt.clientSite.domain)
        await prisma.$transaction(async (tx) => {
          await tx.aiVisibilityRun.update({
            where: { id: runId },
            data: {
              status: 'SUCCEEDED',
              searchedWeb: result.searchedWeb,
              brandMentioned: mentionsBrand(result.text, aliases),
              responseText: result.text,
              citationCount: rows.length,
              usage: toDatabaseJson(result.usage),
            },
          })
          if (rows.length)
            await tx.aiCitation.createMany({
              data: rows.map((citation) => ({
                ...citation,
                clientSiteId: prompt.clientSiteId,
                runId,
                articleId: citedArticle(citation, articles),
              })),
              skipDuplicates: true,
            })
        })
        await logger.info('ai visibility provider completed', {
          source: 'ai-visibility',
          clientSiteId: prompt.clientSiteId,
          promptId,
          runId,
          provider: result.provider,
          model: result.model,
          citations: rows.length,
          ownedCitations: rows.filter((row) => row.owned).length,
          searchedWeb: result.searchedWeb,
        })
        return {
          status: 'succeeded' as const,
          runId,
          provider: result.provider,
          model: result.model,
          citations: rows.length,
          searchedWeb: result.searchedWeb,
          totalTokens: result.totalTokens,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000)
        await prisma.aiVisibilityRun.update({ where: { id: runId }, data: { status: 'FAILED', error: message } })
        await logger.error('ai visibility provider failed', {
          source: 'ai-visibility',
          clientSiteId: prompt.clientSiteId,
          promptId,
          runId,
          provider: provider.provider,
          model: provider.model,
          error: message,
        })
        await logAction({
          action: 'AI_VISIBILITY_FAILED',
          userId: actorId,
          clientSiteId: prompt.clientSiteId,
          metadata: { promptId, runId, provider: provider.provider, model: provider.model, error: message },
        }).catch(() => undefined)
        return { status: 'failed' as const, runId, provider: provider.provider, model: provider.model, error: message }
      }
    }),
  )

  const succeeded = outcomes.filter((outcome) => outcome.status === 'succeeded')
  if (!succeeded.length) {
    return {
      status: 'failed' as const,
      runId: outcomes[0]?.runId,
      runIds: outcomes.map((outcome) => outcome.runId),
      error: outcomes.map((outcome) => ('error' in outcome ? `${outcome.provider}: ${outcome.error}` : '')).join('; '),
      providers: outcomes,
    }
  }

  await consumeClientTokens(
    prompt.clientSiteId,
    succeeded.reduce((sum, outcome) => sum + outcome.totalTokens, 0),
    'AI_VISIBILITY_CHECKED',
    {
      promptId,
      runIds: outcomes.map((outcome) => outcome.runId),
      providers: outcomes.map((outcome) => ({
        provider: outcome.provider,
        model: outcome.model,
        status: outcome.status,
        ...('citations' in outcome ? { citations: outcome.citations, searchedWeb: outcome.searchedWeb } : {}),
      })),
    },
    undefined,
    actorId,
  )
  await syncOpportunity(promptId, prompt.clientSite.id).catch((error) =>
    logger.error('ai visibility opportunity sync failed', {
      source: 'ai-visibility',
      clientSiteId: prompt.clientSite.id,
      promptId,
      runIds: outcomes.map((outcome) => outcome.runId),
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  await logger.info('ai visibility prompt completed', {
    source: 'ai-visibility',
    clientSiteId: prompt.clientSite.id,
    promptId,
    succeeded: succeeded.length,
    failed: outcomes.length - succeeded.length,
    providers: outcomes.map((outcome) => outcome.provider),
  })
  return {
    status: 'succeeded' as const,
    runId: succeeded[0]!.runId,
    runIds: outcomes.map((outcome) => outcome.runId),
    providers: outcomes,
  }
}
