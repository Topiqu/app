export interface ArticlePack {
  id: string
  articles: number
  priceUsd: number
  name: string
}

export const ARTICLE_PACKS: Record<string, ArticlePack> = {
  '5': { id: '5', articles: 5, priceUsd: 8.99, name: '5 additional articles' },
  '12': { id: '12', articles: 12, priceUsd: 14.99, name: '12 additional articles' },
  '25': { id: '25', articles: 25, priceUsd: 22.49, name: '25 additional articles' },
}

export const ARTICLE_PACK_LIST = Object.values(ARTICLE_PACKS)

export const getArticlePack = (id: unknown): ArticlePack | null =>
  typeof id === 'string' && id in ARTICLE_PACKS ? ARTICLE_PACKS[id]! : null

export const formatArticlePackPrice = (pack: ArticlePack, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(
    pack.priceUsd,
  )
