import type { Language } from '@prisma/client'
import type { SitemapUrl } from '#sitemap/types'

import { hasSeoPlan } from '~~/shared/utils/seo'
import { articlePath, authorPath, homePath, tagPath } from '~~/shared/utils/routes'

type Alternative = { hreflang: string; href: string }

/** Per-host sitemap source. The module forwards the request host and keys its cache by it. */
export default defineSitemapEventHandler(async (event) => {
  const tenant = await tenantByHost(event)
  if (!tenant) return []

  const primary = tenant.language as Language

  const articles = await prisma.article.findMany({
    where: { clientSiteId: tenant.id, status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true,
      createdAt: true,
      user: { select: { username: true } },
      tags: { select: { tag: { select: { name: true } } } },
      translations: {
        where: { status: 'PUBLISHED', slug: { not: null } },
        select: { slug: true, language: true, updatedAt: true },
      },
    },
  })

  // The homepage self-reports `noindex` while it has nothing to show.
  if (!articles.length) return []

  const urls: SitemapUrl[] = [{ loc: homePath(primary), changefreq: 'daily', priority: 1 }]

  for (const article of articles) {
    const languages: { language: Language; slug: string; updatedAt: Date | null }[] = [
      { language: primary, slug: article.slug, updatedAt: article.updatedAt },
      ...article.translations.map((tr) => ({
        language: tr.language as Language,
        slug: tr.slug!,
        updatedAt: tr.updatedAt,
      })),
    ]

    // A single-language article gets no alternates — the other locale just 302s back.
    const alternatives: Alternative[] =
      languages.length > 1
        ? languages.map((entry) => ({ hreflang: entry.language, href: articlePath(entry.language, entry.slug) }))
        : []

    const xDefault = alternatives.length ? [{ hreflang: 'x-default', href: articlePath(primary, article.slug) }] : []

    for (const entry of languages) {
      urls.push({
        loc: articlePath(entry.language, entry.slug),
        lastmod: entry.updatedAt ?? article.publishedAt ?? article.createdAt,
        changefreq: 'weekly',
        priority: 0.8,
        ...(alternatives.length ? { alternatives: [...alternatives, ...xDefault] } : {}),
      })
    }
  }

  // Tag and author pages self-report `noindex` on BASIC.
  if (hasSeoPlan(tenant.plan)) {
    const tags = new Set(articles.flatMap((a) => a.tags.map((t) => t.tag.name)))
    const authors = new Set(articles.map((a) => a.user?.username).filter((name): name is string => !!name))

    for (const tag of tags) urls.push({ loc: tagPath(primary, tag), changefreq: 'weekly', priority: 0.5 })
    for (const author of authors) urls.push({ loc: authorPath(primary, author), changefreq: 'weekly', priority: 0.4 })
  }

  return urls
})
