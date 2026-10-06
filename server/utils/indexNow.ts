import type { Language } from '~~/generated/zenstack/models'

import { createHmac } from 'node:crypto'
import { articlePath } from '~~/shared/utils/routes'
import { isManagedDomain } from '~~/shared/utils/domain'

const ENDPOINT = 'https://api.indexnow.org/indexnow'
export const INDEXNOW_KEY_PATH = '/indexnow.txt'

/** Derived per tenant, so there is no key to store or rotate; it is public by design. */
export const indexNowKey = (clientSiteId: string) => {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return createHmac('sha256', secret).update(`indexnow:${clientSiteId}`).digest('hex').slice(0, 32)
}

/** Source and published translation URLs of an article that has ever been public. */
export const articlePublicPaths = async (articleId: string, clientSiteId: string) => {
  const article = await prisma.article.findFirst({
    where: { id: articleId, clientSiteId, publishedAt: { not: null } },
    select: {
      slug: true,
      language: true,
      translations: {
        where: { status: 'PUBLISHED', slug: { not: null } },
        select: { slug: true, language: true },
      },
    },
  })
  if (!article) return []
  return [
    articlePath(article.language, article.slug),
    ...article.translations.map((translation) => articlePath(translation.language as Language, translation.slug!)),
  ]
}

/**
 * Tells IndexNow engines (Bing, which grounds ChatGPT search and Copilot; Seznam; Yandex) that an
 * article changed. A live article announces its own URLs; a removed one needs its old URLs passed
 * in, computed before they disappear. Never throws: it must not fail the write that triggered it.
 */
export const announceArticle = async (articleId: string, clientSiteId: string, removedPaths: string[] = []) => {
  if ((process.env.APP_ENV || process.env.NODE_ENV) !== 'production') return
  try {
    const [article, site] = await Promise.all([
      prisma.article.findFirst({ where: { id: articleId, clientSiteId }, select: { status: true } }),
      prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { domain: true, domainVerified: true } }),
    ])
    // The same rule `tenantByHost` serves by: an unverified custom domain shows nothing.
    if (!site?.domain || (!site.domainVerified && !isManagedDomain(site.domain))) return

    const live = article?.status === 'published' ? await articlePublicPaths(articleId, clientSiteId) : []
    const paths = [...new Set([...removedPaths, ...live])]
    if (!paths.length) return

    const origin = `https://${site.domain}`
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: site.domain,
        key: indexNowKey(clientSiteId),
        keyLocation: `${origin}${INDEXNOW_KEY_PATH}`,
        urlList: paths.map((path) => `${origin}${path}`),
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`IndexNow responded ${response.status}`)
  } catch (error) {
    await reportCaughtError('IndexNow submission failed', error, { articleId, clientSiteId })
  }
}
