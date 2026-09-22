export type FactCheckVerdict = 'supported' | 'partial' | 'unsupported' | 'contradicted' | 'unverifiable'
export type FactCheckImportance = 'high' | 'medium' | 'low'
export type FactCheckSourceStatus = 'ready' | 'duplicate' | 'invalid' | 'unreachable' | 'unsupported-content'

export interface ArticleFactCheckInput {
  title: string
  excerpt: string | null
  content: string
  sources: string[]
  language: 'cs' | 'en'
}

export interface FactCheckSource {
  index: number
  url: string
  status: FactCheckSourceStatus
  title?: string
  publishedAt?: string
  duplicateOf?: number
  detail?: 'invalid-url' | 'private-host' | 'http-error' | 'timeout' | 'too-large' | 'not-readable'
}

export interface FactCheckSourceMatch {
  sourceIndex: number
  support: 'full' | 'partial' | 'contradiction' | 'context'
  evidence: string
}

export interface FactCheckClaim {
  id: string
  text: string
  blockIndex: number
  verdict: FactCheckVerdict
  importance: FactCheckImportance
  explanation: string
  sourceMatches: FactCheckSourceMatch[]
}

export interface ArticleFactCheckResult {
  analyzedAt: string
  claims: FactCheckClaim[]
  sources: FactCheckSource[]
  counts: Record<FactCheckVerdict, number> & { total: number; problematic: number }
}
