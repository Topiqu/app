import type { ArticleFactCheckResult, FactCheckClaim, FactCheckVerdict } from '../types/articleFactCheck'

export const FACT_CHECK_LIMITS = {
  maxArticleCharacters: 60_000,
  maxSources: 10,
  maxSourceBytes: 600_000,
  maxSourceCharacters: 24_000,
  maxTotalSourceCharacters: 80_000,
  maxClaims: 40,
} as const

export interface FactCheckArticleBlock {
  index: number
  type: string
  text: string
}

export const normalizeFactCheckUrl = (value: string) => {
  const url = new URL(value.trim())
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))
    url.port = ''
  return url.toString()
}

export const extractFactCheckBlocks = (html: string): FactCheckArticleBlock[] => {
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return [...doc.body.children].flatMap((node, index) => {
    if (node.matches('script, style, noscript, img, video, audio, iframe')) return []
    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    return text ? [{ index, type: node.tagName.toLowerCase(), text }] : []
  })
}

export const factCheckCounts = (claims: FactCheckClaim[]): ArticleFactCheckResult['counts'] => {
  const counts: Record<FactCheckVerdict, number> = {
    supported: 0,
    partial: 0,
    unsupported: 0,
    contradicted: 0,
    unverifiable: 0,
  }
  claims.forEach((claim) => counts[claim.verdict]++)
  return {
    ...counts,
    total: claims.length,
    problematic: counts.partial + counts.unsupported + counts.contradicted,
  }
}

const importanceOrder = { high: 0, medium: 1, low: 2 } as const
const verdictOrder: Record<FactCheckVerdict, number> = {
  contradicted: 0,
  unsupported: 1,
  partial: 2,
  unverifiable: 3,
  supported: 4,
}

export const sortFactCheckClaims = (claims: FactCheckClaim[]) =>
  [...claims].sort(
    (a, b) =>
      verdictOrder[a.verdict] - verdictOrder[b.verdict] ||
      importanceOrder[a.importance] - importanceOrder[b.importance] ||
      a.blockIndex - b.blockIndex,
  )
