import { ARTICLE_PACK_LIST, formatArticlePackPrice, type ArticlePack } from '~~/shared/utils/articlePacks'

export const FALLBACK_PACK_ICON = 'mdi:file-document-plus-outline'

export interface ArticlePackView {
  id: string
  name: string
  articles: number
  icon: string
  featured: boolean
  price: string
  valueBonus: number
}

export const PACK_PRESENTATION: Record<string, { label?: string; icon: string; featured?: boolean }> = {
  '5': { label: 'common.articlePacks.pack5', icon: 'mdi:file-document-plus-outline' },
  '10': { label: 'common.articlePacks.pack10', icon: 'mdi:file-document-multiple-outline' },
  '25': { label: 'common.articlePacks.pack25', icon: 'mdi:rocket-launch', featured: true },
}

export const buildArticlePackViews = (
  translate: (key: string) => string,
  locale: string,
  packs: ArticlePack[] = ARTICLE_PACK_LIST,
): ArticlePackView[] => {
  const baseline = packs[0]
  const baselineArticlesPerDollar = baseline ? baseline.articles / baseline.priceUsd : 0

  return packs.map((pack) => {
    const presentation = PACK_PRESENTATION[pack.id]
    const articlesPerDollar = pack.priceUsd > 0 ? pack.articles / pack.priceUsd : 0
    return {
      id: pack.id,
      name: presentation?.label ? translate(presentation.label) : pack.name,
      articles: pack.articles,
      icon: presentation?.icon ?? FALLBACK_PACK_ICON,
      featured: presentation?.featured ?? false,
      price: formatArticlePackPrice(pack, locale),
      valueBonus:
        baselineArticlesPerDollar > 0
          ? Math.max(0, Math.round((articlesPerDollar / baselineArticlesPerDollar - 1) * 100))
          : 0,
    }
  })
}
