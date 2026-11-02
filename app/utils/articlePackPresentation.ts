export interface ArticlePackView {
  id: string
  name: string
  articles: number
  featured: boolean
  price: string
}

export const PACK_PRESENTATION: Record<string, { label?: string; featured?: boolean }> = {
  '5': { label: 'common.articlePacks.pack5' },
  '12': { label: 'common.articlePacks.pack12' },
  '25': { label: 'common.articlePacks.pack25', featured: true },
}

export const buildArticlePackViews = (
  translate: (key: string) => string,
  locale: string,
  packs: ArticlePack[] = ARTICLE_PACK_LIST,
): ArticlePackView[] => {
  return packs.map((pack) => {
    const presentation = PACK_PRESENTATION[pack.id]
    return {
      id: pack.id,
      name: presentation?.label ? translate(presentation.label) : pack.name,
      articles: pack.articles,
      featured: presentation?.featured ?? false,
      price: formatArticlePackPrice(pack, locale),
    }
  })
}
