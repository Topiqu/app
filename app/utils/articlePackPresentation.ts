import { ARTICLE_PACK_LIST, formatArticlePackPrice, type ArticlePack } from '~~/shared/utils/articlePacks'

export interface ArticlePackView {
  id: string
  name: string
  articles: number
  featured: boolean
  price: string
  volumeDiscount: number
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
  const baseline = packs[0]
  const baselinePricePerArticle = baseline ? baseline.priceUsd / baseline.articles : 0

  return packs.map((pack) => {
    const presentation = PACK_PRESENTATION[pack.id]
    const pricePerArticle = pack.articles > 0 ? pack.priceUsd / pack.articles : 0
    return {
      id: pack.id,
      name: presentation?.label ? translate(presentation.label) : pack.name,
      articles: pack.articles,
      featured: presentation?.featured ?? false,
      price: formatArticlePackPrice(pack, locale),
      volumeDiscount:
        baselinePricePerArticle > 0
          ? Math.max(0, Math.round(((1 - pricePerArticle / baselinePricePerArticle) * 100) / 5) * 5)
          : 0,
    }
  })
}
