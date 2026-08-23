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
  icon: string
  featured: boolean
  price: string
  articles: number
}

export const PACK_PRESENTATION: Record<string, TokenPackPresentation> = {
  '10000': { label: 'common.tokens.pack10k', icon: FALLBACK_PACK_ICON },
  '25000': { label: 'common.tokens.pack25k', icon: 'mdi:star-half-full' },
  '50000': { label: 'common.tokens.pack50k', icon: 'mdi:diamond-stone', featured: true },
}

export const buildTokenPackViews = (
  translate: (key: string) => string,
  locale: string,
  packs: TokenPack[] = TOKEN_PACK_LIST,
): TokenPackView[] =>
  packs.map((pack) => {
    const presentation = PACK_PRESENTATION[pack.id]
    return {
      id: pack.id,
      name: presentation?.label ? translate(presentation.label) : pack.name,
      icon: presentation?.icon ?? FALLBACK_PACK_ICON,
      featured: presentation?.featured ?? false,
      price: formatTokenPackPrice(pack, locale),
      articles: Math.floor(pack.tokens / TOKENS_PER_ARTICLE),
    }
  })
