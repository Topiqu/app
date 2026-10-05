import type { Language } from '~~/generated/zenstack/models'

import * as cheerio from 'cheerio'
import { articlePath } from '~~/shared/utils/routes'
import { articleLinkTarget } from '~~/shared/utils/articleOptimization'

type LinkDb = {
  article: { findMany: (args: any) => Promise<any[]> }
  articleTranslation: { findMany: (args: any) => Promise<any[]> }
  articleSlugRedirect: { findMany: (args: any) => Promise<any[]> }
}

type Source = { id: string; slug: string }
type Translation = { articleId: string; slug: string; language: Language }
type Target = { id: string; slug: string; language: Language }

/**
 * Bodies keep the URL a link was written with. At render it is pointed at the article's current
 * slug in the reader's language, and unwrapped once the article is unpublished or deleted.
 * `clientSiteId` is the only isolation here, so it must come from the resolved article or tenant.
 */
export const resolveArticleLinks = async (
  db: LinkDb,
  content: string | null | undefined,
  { clientSiteId, language, tenantDomain }: { clientSiteId: string; language: Language; tenantDomain?: string | null },
) => {
  if (!content?.includes('<a')) return content ?? ''

  const $ = cheerio.load(content, null, false)
  const links = $('a[href]')
    .toArray()
    .flatMap((el) => {
      const href = $(el).attr('href') ?? ''
      const target = articleLinkTarget(href, tenantDomain)
      return target ? [{ el, ...target, hash: href.match(/#.*/)?.[0] ?? '' }] : []
    })
  if (!links.length) return content

  const slugs = [...new Set(links.map(({ slug }) => slug))]
  const [sources, translations, redirects]: [Source[], Translation[], Omit<Translation, 'language'>[]] =
    await Promise.all([
      db.article.findMany({ where: { clientSiteId, slug: { in: slugs } }, select: { id: true, slug: true } }),
      db.articleTranslation.findMany({
        where: { clientSiteId, slug: { in: slugs } },
        select: { articleId: true, slug: true, language: true },
      }),
      db.articleSlugRedirect.findMany({
        where: { clientSiteId, slug: { in: slugs } },
        select: { articleId: true, slug: true },
      }),
    ])

  const articleIdOf = ({ slug, language: linkLanguage }: { slug: string; language: Language }) =>
    sources.find((source) => source.slug === slug)?.id ??
    translations.find((translation) => translation.slug === slug && translation.language === linkLanguage)
      ?.articleId ??
    redirects.find((redirect) => redirect.slug === slug)?.articleId

  const ids = [...new Set(links.flatMap((link) => articleIdOf(link) ?? []))]
  const [targets, rendered]: [Target[], Omit<Translation, 'language'>[]] = ids.length
    ? await Promise.all([
        db.article.findMany({
          where: { clientSiteId, id: { in: ids }, status: 'published' },
          select: { id: true, slug: true, language: true },
        }),
        db.articleTranslation.findMany({
          where: { clientSiteId, articleId: { in: ids }, language, status: 'PUBLISHED', slug: { not: null } },
          select: { articleId: true, slug: true },
        }),
      ])
    : [[], []]

  for (const link of links) {
    const id = articleIdOf(link)
    const target = targets.find((candidate) => candidate.id === id)
    if (!target) {
      $(link.el).replaceWith($(link.el).contents())
      continue
    }
    const translated = rendered.find((translation) => translation.articleId === id)?.slug
    // Without a published translation the reader gets the original rather than a dead end.
    const href =
      target.language === language
        ? articlePath(language, target.slug)
        : translated
          ? articlePath(language, translated)
          : articlePath(target.language, target.slug)
    $(link.el).attr('href', href + link.hash)
  }

  return $.html()
}
