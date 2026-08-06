export interface TokenPack {
  id: string
  tokens: number
  priceUsd: number
  name: string
}

export const TOKEN_PACKS: Record<string, TokenPack> = {
  '10000': { id: '10000', tokens: 10000, priceUsd: 2.99, name: 'Token Pack 10k' },
  '25000': { id: '25000', tokens: 25000, priceUsd: 4.99, name: 'Token Pack 25k' },
  '50000': { id: '50000', tokens: 50000, priceUsd: 9.99, name: 'Token Pack 50k' },
}

export const TOKEN_PACK_LIST: TokenPack[] = Object.values(TOKEN_PACKS)

export const getTokenPack = (id: unknown): TokenPack | null =>
  typeof id === 'string' && id in TOKEN_PACKS ? TOKEN_PACKS[id]! : null

export const formatTokenPackPrice = (pack: TokenPack, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(
    pack.priceUsd,
  )
