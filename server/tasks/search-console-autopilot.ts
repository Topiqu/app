import { subDays, subHours } from 'date-fns'

import { getSearchTrends } from '../utils/searchConsole/opportunities'
import { selectSeoAutopilotCandidate } from '../utils/searchConsole/autopilot'
import { generateContentRefresh, generateCtrOptimization } from '../utils/ai/seoAutopilot'

const MIN_TOKENS = 2500
const RUN_COOLDOWN_HOURS = 20
const ACTION_COOLDOWN_DAYS = 30

export default defineMonitoredTask({
  meta: {
    name: 'search-console-autopilot',
    description: 'Autonomously improves published articles from Search Console signals for opted-in tenants',
  },
  async run() {
    const now = new Date()
    const dueBefore = subHours(now, RUN_COOLDOWN_HOURS)
    const connections = await prisma.searchConsoleConnection.findMany({
      where: {
        autopilotEnabled: true,
        status: 'CONNECTED',
        propertyUrl: { not: null },
        OR: [{ autopilotLastRunAt: null }, { autopilotLastRunAt: { lte: dueBefore } }],
        clientSite: {
          plan: { in: ['PREMIUM', 'CUSTOM'] },
          tokenRemaining: { gt: MIN_TOKENS },
          AND: [activeFeatureFilter('SEARCH_CONSOLE'), activeFeatureFilter('AI')],
        },
      },
      select: {
        id: true,
        clientSiteId: true,
        clientSite: {
          select: {
            language: true,
            humanHourlyRateUsd: true,
            humanWordsPerHour: true,
            articles: {
              where: { status: 'published' },
              select: {
                id: true,
                slug: true,
                title: true,
                excerpt: true,
                content: true,
                totalWords: true,
                savedAmount: true,
                savedTimeMinutes: true,
              },
            },
          },
        },
      },
    })

    let changed = 0
    for (const connection of connections) {
      // Atomic daily claim: multiple scheduler replicas cannot write the same tenant twice.
      const claimed = await prisma.searchConsoleConnection.updateMany({
        where: {
          id: connection.id,
          autopilotEnabled: true,
          OR: [{ autopilotLastRunAt: null }, { autopilotLastRunAt: { lte: dueBefore } }],
        },
        data: { autopilotLastRunAt: now },
      })
      if (claimed.count !== 1) continue

      try {
        const trends = await getSearchTrends(connection.clientSiteId)
        const recentLogs = await prisma.log.findMany({
          where: {
            clientSiteId: connection.clientSiteId,
            action: { in: ['SEO_AUTOPILOT_CTR_OPTIMIZED', 'SEO_AUTOPILOT_CONTENT_REFRESHED'] },
            createdAt: { gte: subDays(now, ACTION_COOLDOWN_DAYS) },
          },
          select: { createdAt: true, metadata: true },
        })
        const recentKeys = new Set(
          recentLogs.flatMap((row) => {
            const metadata = row.metadata as { articleId?: unknown; query?: unknown } | null
            return typeof metadata?.articleId === 'string' && typeof metadata.query === 'string'
              ? [`${metadata.articleId}\u0000${metadata.query.toLocaleLowerCase()}`]
              : []
          }),
        )
        const recentlyChangedArticleIds = new Set(
          recentLogs.flatMap((row) => {
            const metadata = row.metadata as { articleId?: unknown } | null
            return row.createdAt >= subDays(now, 7) && typeof metadata?.articleId === 'string'
              ? [metadata.articleId]
              : []
          }),
        )
        const articles = connection.clientSite.articles
        const articleById = new Map(articles.map((article) => [article.id, article]))
        const candidate = selectSeoAutopilotCandidate(
          trends,
          new Map(articles.map((article) => [article.slug, article.id])),
          recentKeys,
          recentlyChangedArticleIds,
        )
        if (!candidate) continue

        const article = articleById.get(candidate.articleId)
        if (!article) continue
        const signal = {
          query: candidate.query,
          impressions: candidate.impressions,
          clicks: candidate.clicks,
          ctr: candidate.ctr,
          position: candidate.position,
        }

        if (candidate.action === 'CTR_OPTIMIZATION') {
          const generated = await generateCtrOptimization(
            { ...article, language: connection.clientSite.language },
            signal,
          )
          if (!generated.tokens) continue
          await consumeClientTokens(connection.clientSiteId, generated.tokens, 'SEO_AUTOPILOT_CTR_TOKENS', {
            articleId: article.id,
            query: candidate.query,
          })
          await prisma.article.update({
            where: { id: article.id },
            data: { title: generated.result.title, excerpt: generated.result.excerpt },
          })
          await syncArticleTranslationQueue(prisma, article.id, connection.clientSiteId, { contentChanged: true })
          await invalidateFeed(connection.clientSiteId)
          await logAction({
            action: 'SEO_AUTOPILOT_CTR_OPTIMIZED',
            clientSiteId: connection.clientSiteId,
            metadata: {
              articleId: article.id,
              query: candidate.query,
              page: candidate.page,
              signal,
              before: { title: article.title, excerpt: article.excerpt },
              after: generated.result,
            },
          })
        } else {
          const generated = await generateContentRefresh(
            { ...article, language: connection.clientSite.language },
            signal,
          )
          if (!generated.tokens) continue
          const addition = sanitizeHtml(
            `<section data-topiqu-seo-refresh="true"><h2>${generated.result.heading}</h2>${generated.result.contentHtml}</section>`,
          )
          const content = stampHeadingIds(`${article.content}\n${addition}`)
          if (content.length > 50000) {
            await logAction({
              action: 'SEO_AUTOPILOT_SKIPPED_CONTENT_LIMIT',
              clientSiteId: connection.clientSiteId,
              metadata: { articleId: article.id, query: candidate.query },
            })
            continue
          }
          await consumeClientTokens(connection.clientSiteId, generated.tokens, 'SEO_AUTOPILOT_REFRESH_TOKENS', {
            articleId: article.id,
            query: candidate.query,
          })
          const metrics = calculateArticleMetrics(
            content,
            connection.clientSite.humanHourlyRateUsd,
            connection.clientSite.humanWordsPerHour,
          )
          await prisma.article.update({
            where: { id: article.id },
            data: {
              content,
              totalWords: metrics.totalWords,
              savedAmount: metrics.savedAmount,
              savedTimeMinutes: metrics.savedTimeMinutes,
            },
          })
          await syncArticleTranslationQueue(prisma, article.id, connection.clientSiteId, { contentChanged: true })
          await invalidateFeed(connection.clientSiteId)
          await logAction({
            action: 'SEO_AUTOPILOT_CONTENT_REFRESHED',
            clientSiteId: connection.clientSiteId,
            metadata: {
              articleId: article.id,
              query: candidate.query,
              page: candidate.page,
              signal,
              before: {
                content: article.content,
                totalWords: article.totalWords,
                savedAmount: article.savedAmount,
                savedTimeMinutes: article.savedTimeMinutes,
              },
              after: { content, heading: generated.result.heading },
            },
          })
        }
        changed++
      } catch (error) {
        await logAction({
          action: 'SEO_AUTOPILOT_FAILED',
          clientSiteId: connection.clientSiteId,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        })
      }
    }

    return { result: { eligible: connections.length, changed, timestamp: now.toISOString() } }
  },
})
