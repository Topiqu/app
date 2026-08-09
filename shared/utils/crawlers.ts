/** Retrieval and user-triggered crawlers — the ones that fetch a page in order to cite it. */
export const ANSWER_ENGINE_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'DuckAssistBot',
  'MistralAI-User',
  'Meta-ExternalFetcher',
  'YouBot',
] as const

/** Corpus builders. Allowed by the wildcard group; blocking them is a product call. */
export const TRAINING_BOTS = [
  'GPTBot',
  'ClaudeBot',
  'meta-externalagent',
  'Amazonbot',
  'CCBot',
  'Bytespider',
  'cohere-ai',
  'Diffbot',
  'Applebot',
] as const

/** Classic search, logged so AI crawl can be compared against it. */
export const SEARCH_BOTS = ['Googlebot', 'bingbot', 'Yandex', 'DuckDuckBot', 'Applebot'] as const

/**
 * Not crawlers: neither issues an HTTP request. Both are robots.txt control tokens for Gemini and
 * Apple Intelligence training and grounding, so `Allow` is the opt-in and a path list is inert.
 */
export const AI_GROUNDING_TOKENS = ['Google-Extended', 'Applebot-Extended'] as const

export type CrawlerKind = 'answer-engine' | 'training' | 'search'

// Longest first: `Applebot` is a prefix of `Applebot-Extended`, `ClaudeBot` shares a stem with
// `Claude-SearchBot`. Shortest-first matching would label the wrong one.
const KNOWN: { token: string; kind: CrawlerKind }[] = [
  ...ANSWER_ENGINE_BOTS.map((token) => ({ token, kind: 'answer-engine' as const })),
  ...TRAINING_BOTS.map((token) => ({ token, kind: 'training' as const })),
  ...SEARCH_BOTS.map((token) => ({ token, kind: 'search' as const })),
].sort((a, b) => b.token.length - a.token.length)

export const detectCrawler = (userAgent: string | undefined | null) => {
  if (!userAgent) return null
  const haystack = userAgent.toLowerCase()
  const hit = KNOWN.find((entry) => haystack.includes(entry.token.toLowerCase()))
  return hit ? { bot: hit.token, kind: hit.kind } : null
}
