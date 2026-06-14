import type { Language } from '@prisma/client'

type TranslationSlugDb = {
  articleTranslation: {
    findMany: (args: any) => Promise<{ slug: string | null }[]>
  }
}

/**
 * Resolves a collision-free localized slug within the `(clientSiteId, language)`
 * namespace, ignoring the article's own existing translation. Mirrors the source
 * article's per-tenant slug dedupe, but scoped per target language — the two live
 * in separate namespaces (primary language in `Article`, each other language here),
 * so they never collide cross-table.
 */
export const dedupeTranslationSlug = async (
  db: TranslationSlugDb,
  base: string,
  clientSiteId: string,
  language: Language,
  articleId: string,
): Promise<string> => {
  const taken = await db.articleTranslation.findMany({
    where: { clientSiteId, language, slug: { startsWith: base }, articleId: { not: articleId } },
    select: { slug: true },
  })
  const set = new Set(taken.map((row) => row.slug))
  if (!set.has(base)) return base
  let counter = 2
  while (set.has(`${base}-${counter}`)) counter++
  return `${base}-${counter}`
}
