import type { AiCrawlerKind, AiCrawlerSurface, AiPromptIntent, AiReferralChannel } from '~~/generated/zenstack/models'

import { toHostname } from './domain'

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
])

export const crawlerKind = (kind: 'answer-engine' | 'training' | 'search'): AiCrawlerKind =>
  ({ 'answer-engine': 'ANSWER_ENGINE', training: 'TRAINING', search: 'SEARCH' })[kind] as AiCrawlerKind

export const crawlerSurface = (path: string): AiCrawlerSurface => {
  if (path === '/llms.txt') return 'LLMS'
  if (path === '/rss.xml') return 'RSS'
  if (path.startsWith('/md/')) return 'MARKDOWN'
  if (/^\/(?:cs|en)\/(?:clanky|articles)\//.test(path)) return 'ARTICLE'
  if (/^\/(?:cs|en)\/?$/.test(path)) return 'HOMEPAGE'
  return 'OTHER'
}

const REFERRERS: Array<[AiReferralChannel, RegExp]> = [
  ['CHATGPT', /(?:^|\.)(?:chatgpt\.com|chat\.openai\.com)$/],
  ['PERPLEXITY', /(?:^|\.)perplexity\.ai$/],
  ['GEMINI', /(?:^|\.)(?:gemini\.google\.com|bard\.google\.com)$/],
  ['COPILOT', /(?:^|\.)(?:copilot\.microsoft\.com|copilot\.cloud\.microsoft)$/],
  ['CLAUDE', /(?:^|\.)claude\.ai$/],
  ['OTHER_AI', /(?:^|\.)(?:you\.com|mistral\.ai|poe\.com)$/],
]

export const aiReferrer = (value: string | null | undefined) => {
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const host = toHostname(url.hostname)
    const channel = REFERRERS.find(([, pattern]) => pattern.test(host))?.[0]
    return channel ? { channel, host } : null
  } catch {
    return null
  }
}

export const normalizeCitationUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.protocol = 'https:'
    url.hostname = toHostname(url.hostname)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
    return url.href
  } catch {
    return null
  }
}

export const isOwnedDomain = (candidate: string, owned: string) => {
  const domain = toHostname(candidate)
  const root = toHostname(owned)
  return domain === root || domain.endsWith(`.${root}`)
}

export const promptIntent = (text: string): AiPromptIntent => {
  const value = text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
  if (/\b(vs\.?|versus|compare|comparison|alternativa|alternativy|srovnani|srovnat|oproti|nejlepsi|best)\b/.test(value))
    return 'COMPARISON'
  if (/\b(how|jak|navod|postup)\b/.test(value)) return 'HOW_TO'
  if (/\b(problem|issue|fix|reseni|vyresit|proc nefunguje)\b/.test(value)) return 'PROBLEM'
  if (/\b(what|which|who|co je|ktery|kdo)\b/.test(value)) return 'DISCOVERY'
  return 'OTHER'
}

export const mentionsBrand = (text: string, aliases: readonly string[]) => {
  const haystack = text.normalize('NFKC').toLocaleLowerCase()
  return aliases.some((alias) => {
    const needle = alias.normalize('NFKC').trim().toLocaleLowerCase()
    return needle.length >= 2 && haystack.includes(needle)
  })
}

const stem = (word: string) => {
  const shortened = word.replace(/(?:ization|ations?|ments?|ovat|ace|ani|eni|niho|ove|ami|emi|ich|ni|u|y|a|e|i)$/u, '')
  return shortened.length >= 4 ? shortened : word
}

const words = (value: string) =>
  new Set(
    (
      value
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]{3,}/gu) ?? []
    ).map(stem),
  )

export const closestArticle = <T extends { title: string; excerpt?: string | null }>(prompt: string, articles: T[]) => {
  const query = words(prompt)
  let winner: { article: T; score: number; overlap: number } | null = null
  for (const article of articles) {
    const candidate = words(`${article.title} ${article.excerpt ?? ''}`)
    const overlap = [...query].filter((word) => candidate.has(word)).length
    const score = query.size ? overlap / query.size : 0
    if (!winner || score > winner.score) winner = { article, score, overlap }
  }
  return winner && winner.overlap >= 2 && winner.score >= 0.18 ? winner.article : null
}
