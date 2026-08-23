import { formatTokenPackPrice, TOKEN_PACK_LIST, type TokenPack } from '~~/shared/utils/tokenPacks'

export const TOKENS_PER_ARTICLE = 5000
export const FALLBACK_PACK_ICON = 'mdi:package-variant'

export interface TokenPackPresentation {
  label?: string
  icon: string
  featured?: boolean
}

export interface TokenPackView {
  id: string
  name: string
  tokens: number
  icon: string
  featured: boolean
  price: string
  articles: number
  valueBonus: number
}

export const PACK_PRESENTATION: Record<string, TokenPackPresentation> = {
  '10000': { label: 'common.tokens.pack10k', icon: FALLBACK_PACK_ICON },
  '25000': { label: 'common.tokens.pack25k', icon: 'mdi:star-half-full' },
  '50000': { label: 'common.tokens.pack50k', icon: 'mdi:diamond-stone' },
  '75000': { label: 'common.tokens.pack75k', icon: 'mdi:rocket-launch', featured: true },
}

export const buildTokenPackViews = (
  translate: (key: string) => string,
  locale: string,
  packs: TokenPack[] = TOKEN_PACK_LIST,
): TokenPackView[] => {
  const baseline = packs[0]
  const baselineTokensPerDollar = baseline ? baseline.tokens / baseline.priceUsd : 0

  return packs.map((pack) => {
    const presentation = PACK_PRESENTATION[pack.id]
    const tokensPerDollar = pack.priceUsd > 0 ? pack.tokens / pack.priceUsd : 0
    return {
      id: pack.id,
      name: presentation?.label ? translate(presentation.label) : pack.name,
      tokens: pack.tokens,
      icon: presentation?.icon ?? FALLBACK_PACK_ICON,
      featured: presentation?.featured ?? false,
      price: formatTokenPackPrice(pack, locale),
      articles: Math.floor(pack.tokens / TOKENS_PER_ARTICLE),
      valueBonus:
        baselineTokensPerDollar > 0
          ? Math.max(0, Math.round((tokensPerDollar / baselineTokensPerDollar - 1) * 100))
          : 0,
    }
  })
}
