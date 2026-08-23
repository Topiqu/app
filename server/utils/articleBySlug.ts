import type { Language } from '@prisma/client'

type SlugDb = {
  article: { findUnique: (args: any) => Promise<any> }
  articleTranslation: { findUnique: (args: any) => Promise<any> }
}

export type SlugLookup = {
  slug: string
  clientSiteId: string
  locale?: Language | string
  primaryLanguage: Language | string
  isAdmin?: boolean
}

/**
 * On a non-primary locale the URL carries the ArticleTranslation slug, which does not exist on
 * Article at all — reading only Article is what 500'd /related for every /en visitor. Falls back
 * to the source row so an untranslated locale (legacy i18n alias) still resolves.
 */
export const resolveArticleBySlug = async <T>(db: SlugDb, lookup: SlugLookup, select: object): Promise<T | null> => {
  const { slug, clientSiteId, locale, primaryLanguage } = lookup

  if (locale && locale !== primaryLanguage) {
    const translation = await db.articleTranslation.findUnique({
      where: { slug_clientSiteId_language: { slug, clientSiteId, language: locale } },
      select: { status: true, article: { select } },
    })
    if (translation?.status === 'PUBLISHED') return translation.article
  }

  return db.article.findUnique({ where: { slug_clientSiteId: { slug, clientSiteId } }, select })
}
