export type KeywordPlanStatus = 'OPEN' | 'PINNED' | 'SKIPPED'

export interface KeywordPlanCluster {
  id: string
  keyword: string
  volume: number
  difficulty: number | null
  pillar: string | null
  status: KeywordPlanStatus
  reason: string | null
}

export interface KeywordPlanResult {
  id: string
  keyword: string
  position: number | null
  firstPosition: number | null
  url: string | null
  article: { id: string; title: string } | null
}

interface KeywordPlan {
  enabled: boolean
  written: { topics: number; volume: number }
  market: KeywordMarket
  markets: KeywordMarket[]
  clusters: KeywordPlanCluster[]
  results: KeywordPlanResult[]
}

/** The plan list and the ranking results share one request; both components read the same cache entry. */
export const useKeywordPlan = () => {
  const requestFetch = useRequestFetch()
  return useQuery({
    key: () => queryKeys.keywordPlan.list,
    // Typed by hand: inferring it from the route table exceeds TypeScript's depth limit.
    query: () => requestFetch<KeywordPlan>('/api/keyword-plan'),
  })
}
