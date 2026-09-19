import { toHostname } from '~~/shared/utils/domain'
import { detectCrawler } from '~~/shared/utils/crawlers'
import { crawlerKind, crawlerSurface } from '~~/shared/utils/aiVisibility'

// Assets dominate request volume and say nothing about crawl coverage.
const IGNORED =
  /^\/(_nuxt|_fonts|_ipx|__og-image__|__nuxt|_scripts|api\/_)|\.(js|css|map|png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/

/**
 * One line per crawler hit on a content route. Answers the questions a schema validator cannot:
 * whether the AI crawlers arrive at all, whether they reach the markdown and llms.txt surfaces,
 * and whether the rate limiter is turning them away with 429s.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('afterResponse', async (event) => {
    const path = event.path?.split('?')[0] ?? ''
    if (!path || IGNORED.test(path)) return

    const crawler = detectCrawler(getRequestHeader(event, 'user-agent'))
    if (!crawler) return

    const status = event.node.res.statusCode
    const tenant = await cachedTenantByHost(event)

    if (tenant) {
      const now = new Date()
      const date = new Date(now)
      date.setUTCHours(0, 0, 0, 0)
      try {
        await prisma.aiCrawlerDaily.upsert({
          where: {
            clientSiteId_date_bot_path: { clientSiteId: tenant.id, date, bot: crawler.bot, path },
          },
          create: {
            clientSiteId: tenant.id,
            date,
            bot: crawler.bot,
            kind: crawlerKind(crawler.kind),
            surface: crawlerSurface(path),
            path,
            requestCount: 1,
            successCount: status < 400 ? 1 : 0,
            errorCount: status >= 400 ? 1 : 0,
            rateLimitedCount: status === 429 ? 1 : 0,
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: {
            requestCount: { increment: 1 },
            successCount: { increment: status < 400 ? 1 : 0 },
            errorCount: { increment: status >= 400 ? 1 : 0 },
            rateLimitedCount: { increment: status === 429 ? 1 : 0 },
            lastSeenAt: now,
          },
        })
      } catch (error) {
        await logger.error('crawler persistence failed', {
          source: 'crawler',
          bot: crawler.bot,
          clientSiteId: tenant.id,
          path,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    await logger.info(`crawl:${crawler.bot}`, {
      source: 'crawler',
      bot: crawler.bot,
      kind: crawler.kind,
      clientSiteId: tenant?.id,
      host: toHostname(getRequestHost(event, { xForwardedHost: true }) || ''),
      path,
      status,
      // The reason the read surfaces got their own rate limit — a crawler collecting 429s
      // partway down a sitemap looks identical to one that simply stopped.
      rateLimited: status === 429,
    })
  })
})
