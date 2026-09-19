import { generateText } from 'ai'
import { toHostname } from '~~/shared/utils/domain'
import { closestArticle, isOwnedDomain, mentionsBrand, normalizeCitationUrl } from '~~/shared/utils/aiVisibility'

import { aiModelId } from './modelRegistry'
import { aiModel, aiWebSearchTool } from './models'

const SAMPLE_SIZE = 6

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
    const run = await tx.aiVisibilityRun.create({
      data: {
        promptId,
        clientSiteId: prompt.clientSiteId,
        provider: 'OPENAI',
        model: aiModelId('visibility'),
      },
      select: { id: true },
    })
    await tx.aiVisibilityPrompt.update({ where: { id: promptId }, data: { lastRunAt: new Date() } })
    return { prompt, runId: run.id }
  })

  if (!claimed) return { status: 'skipped' as const, reason: 'inactive_or_running' }
  const { prompt, runId } = claimed

  try {
    const result = await generateText({
      model: aiModel('visibility'),
      system:
        'Answer the user query naturally and impartially as an AI search assistant. Use live web search. Do not favor or suppress any named brand or domain. Cite the sources that support the answer.',
      prompt: prompt.text,
      maxOutputTokens: 1400,
      toolChoice: 'required',
      tools: { web_search: aiWebSearchTool('medium') as never },
      abortSignal: AbortSignal.timeout(60_000),
      providerOptions: { openai: { reasoningEffort: 'low' } },
    })

    const rows = citationRows(result.sources as never, prompt.clientSite.domain)
    const articles = await prisma.article.findMany({
      where: { clientSiteId: prompt.clientSiteId, status: 'published' },
      select: { id: true, slug: true, translations: { select: { slug: true }, where: { status: 'PUBLISHED' } } },
    })
    const aliases = [prompt.clientSite.name, toHostname(prompt.clientSite.domain).split('.')[0] ?? '']
    const searchedWeb = result.toolResults.some((tool) => tool.toolName === 'web_search')

    await prisma.$transaction(async (tx) => {
      await tx.aiVisibilityRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCEEDED',
          searchedWeb,
          brandMentioned: mentionsBrand(result.text, aliases),
          responseText: result.text,
          citationCount: rows.length,
          usage: JSON.parse(JSON.stringify(result.usage ?? {})),
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

    await consumeClientTokens(
      prompt.clientSiteId,
      result.usage.totalTokens ?? 0,
      'AI_VISIBILITY_CHECKED',
      { promptId, runId, citations: rows.length, searchedWeb, model: aiModelId('visibility') },
      undefined,
      actorId,
    )
    await syncOpportunity(promptId, prompt.clientSiteId).catch((error) =>
      logger.error('ai visibility opportunity sync failed', {
        source: 'ai-visibility',
        clientSiteId: prompt.clientSiteId,
        promptId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
    await logger.info('ai visibility prompt completed', {
      source: 'ai-visibility',
      clientSiteId: prompt.clientSiteId,
      promptId,
      runId,
      citations: rows.length,
      ownedCitations: rows.filter((row) => row.owned).length,
      searchedWeb,
    })
    return { status: 'succeeded' as const, runId }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000)
    await prisma.aiVisibilityRun.update({ where: { id: runId }, data: { status: 'FAILED', error: message } })
    await logger.error('ai visibility prompt failed', {
      source: 'ai-visibility',
      clientSiteId: prompt.clientSiteId,
      promptId,
      runId,
      error: message,
    })
    await logAction({
      action: 'AI_VISIBILITY_FAILED',
      userId: actorId,
      clientSiteId: prompt.clientSiteId,
      metadata: { promptId, runId, error: message, model: aiModelId('visibility') },
    }).catch(() => undefined)
    return { status: 'failed' as const, runId, error: message }
  }
}
