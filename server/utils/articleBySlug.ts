import type { Language } from '~~/generated/zenstack/models'

type SlugDb = {
  article: { findUnique: (args: any) => Promise<any> }
  articleTranslation: { findUnique: (args: any) => Promise<any> }
}

export type SlugLookup = {
  slug: string
  clientSiteId: string
  locale?: Language | string
  isAdmin?: boolean
}

/**
 * The source language belongs to Article, not ClientSite. Prefer the source when its slug
 * matches the requested locale, then try a published translation, then fall back to the source.
 */
export const resolveArticleBySlug = async <T>(db: SlugDb, lookup: SlugLookup, select: object): Promise<T | null> => {
  const { slug, clientSiteId, locale } = lookup

  const source = await db.article.findUnique({ where: { slug_clientSiteId: { slug, clientSiteId } }, select })
  if (source && (!locale || source.language === locale)) return source

  if (locale) {
    const translation = await db.articleTranslation.findUnique({
      where: { slug_clientSiteId_language: { slug, clientSiteId, language: locale } },
      select: { status: true, article: { select } },
    })
    if (translation?.status === 'PUBLISHED') return translation.article
  }

  return source
}
