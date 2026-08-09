import { toHostname } from '~~/shared/utils/domain'
import { detectCrawler } from '~~/shared/utils/crawlers'

// Assets dominate request volume and say nothing about crawl coverage.
const IGNORED = /^\/(_nuxt|_fonts|_ipx|__og-image__|__nuxt|_scripts|api\/_)|\.(js|css|map|png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/

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

    await logger.info(`crawl:${crawler.bot}`, {
      source: 'crawler',
      bot: crawler.bot,
      kind: crawler.kind,
      host: toHostname(getRequestHost(event, { xForwardedHost: true }) || ''),
      path,
      status,
      // The reason the read surfaces got their own rate limit — a crawler collecting 429s
      // partway down a sitemap looks identical to one that simply stopped.
      rateLimited: status === 429,
    })
  })
})
