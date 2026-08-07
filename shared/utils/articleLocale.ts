export interface LocalizableArticle {
  id: string
  slug: string
  title: string
  excerpt: string | null
}

/** The subset of a PUBLISHED `ArticleTranslation` a listing card needs. */
export interface TranslationOverlay {
  articleId: string
  slug: string | null
  title: string | null
  excerpt: string | null
}

/**
 * A translation takes over a card only when it can also be linked: without both slug and
 * title the card would show localized text pointing at the primary-language URL. Excerpt is
 * allowed to fall back — a missing perex degrades the card, a missing slug breaks it.
 */
export const overlayTranslation = <T extends LocalizableArticle>(article: T, overlay?: TranslationOverlay): T => {
  if (!overlay?.slug || !overlay.title) return article

  return { ...article, slug: overlay.slug, title: overlay.title, excerpt: overlay.excerpt ?? article.excerpt }
}

export const overlayTranslations = <T extends LocalizableArticle>(
  articles: T[],
  overlays: TranslationOverlay[],
): T[] => {
  if (!overlays.length) return articles

  const byArticle = new Map(overlays.map((row) => [row.articleId, row]))

  return articles.map((article) => overlayTranslation(article, byArticle.get(article.id)))
}
