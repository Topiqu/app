import type { AiCrawlerKind, AiCrawlerSurface, AiPromptIntent, AiReferralChannel } from '~~/generated/zenstack/models'

import { toHostname } from './domain'
import { isLanguage } from './language'
import { LOCALIZED_SEGMENTS } from './routes'

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
  const [, language, segment, slug] = path.split('/')
  if (isLanguage(language)) {
    if (segment === LOCALIZED_SEGMENTS.article[language] && slug) return 'ARTICLE'
    if (!segment) return 'HOMEPAGE'
  }
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
  if (
    /\b(vs\.?|versus|compare|comparison|alternativa|alternativy|srovnani|srovnat|oproti|nejlepsi|best|beste|besten|vergleich|vergleichen|comparaison|comparer|meilleur|meilleure)\b/.test(
      value,
    )
  )
    return 'COMPARISON'
  if (/\b(how|jak|navod|postup|wie|anleitung|comment|tutoriel)\b/.test(value)) return 'HOW_TO'
  if (
    /\b(problem|issue|fix|reseni|vyresit|proc nefunguje|fehler|beheben|losung|probleme|erreur|resoudre)\b/.test(value)
  )
    return 'PROBLEM'
  if (/\b(what|which|who|co je|ktery|kdo|was|welche|wer|quoi|qui|quel|quelle)\b/.test(value)) return 'DISCOVERY'
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

type OutcomeRun = { status: string; citations: readonly { owned: boolean }[] }

export const runOutcome = (run: OutcomeRun) => {
  if (run.status === 'SUCCEEDED') return run.citations.some((citation) => citation.owned) ? 'CITED' : 'NOT_CITED'
  return run.status === 'RUNNING' ? 'RUNNING' : 'FAILED'
}

/** Rolls the latest run of each provider into one verdict; `checked` counts only answers that came back. */
export const promptOutcome = (runs: readonly OutcomeRun[]) => {
  const outcomes = runs.map(runOutcome)
  const cited = outcomes.filter((outcome) => outcome === 'CITED').length
  const checked = cited + outcomes.filter((outcome) => outcome === 'NOT_CITED').length
  const verdict = (status: 'UNCHECKED' | 'CITED' | 'NOT_CITED' | 'RUNNING' | 'FAILED') => ({ status, cited, checked })
  if (!runs.length) return verdict('UNCHECKED')
  if (cited) return verdict('CITED')
  if (checked) return verdict('NOT_CITED')
  return verdict(outcomes.includes('RUNNING') ? 'RUNNING' : 'FAILED')
}

/** Round-robin across tenants so one large prompt set cannot starve the rest of a run. */
export const interleaveByTenant = <T extends { clientSiteId: string }>(prompts: readonly T[]) => {
  const queues = new Map<string, T[]>()
  for (const prompt of prompts) {
    const queue = queues.get(prompt.clientSiteId)
    if (queue) queue.push(prompt)
    else queues.set(prompt.clientSiteId, [prompt])
  }
  const order: T[] = []
  for (let round = 0; order.length < prompts.length; round++) {
    for (const queue of queues.values()) if (queue[round]) order.push(queue[round]!)
  }
  return order
}

// Platforms an engine quotes for any topic. A publisher cannot outrank them with an article, so they
// are reported as sources rather than competitors.
const REFERENCE_DOMAINS = [
  'wikipedia.org',
  'wikimedia.org',
  'wikidata.org',
  'reddit.com',
  'quora.com',
  'youtube.com',
  'youtu.be',
  'linkedin.com',
  'medium.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'x.com',
  'twitter.com',
  'github.com',
  'stackoverflow.com',
  'stackexchange.com',
  'google.com',
  'openai.com',
  'chatgpt.com',
  'anthropic.com',
  'claude.ai',
  'x.ai',
  'grok.com',
  'meta.com',
  'mistral.ai',
  'europa.eu',
]
const PUBLIC_SECTOR = /(?:^|\.)(?:gov|edu)(?:\.[a-z]{2})?$|(?:^|\.)(?:gouv\.fr|bund\.de)$/

export const isReferenceDomain = (domain: string) =>
  PUBLIC_SECTOR.test(domain) || REFERENCE_DOMAINS.some((reference) => isOwnedDomain(domain, reference))

/** Unique domains, most cited first. */
export const rankDomains = (domains: readonly string[], hidden: ReadonlySet<string> = new Set()) => {
  const counts = new Map<string, number>()
  for (const domain of domains) if (!hidden.has(domain)) counts.set(domain, (counts.get(domain) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([domain]) => domain)
}

export type DomainMark = 'COMPETITOR' | 'HIDDEN'
type CitedRun = { promptId: string; citations: readonly { domain: string; owned: boolean }[] }

/**
 * A competitor is a domain cited across several of the tenant's questions; one question is noise.
 * `share` uses the same denominator as the tenant's own citation coverage, so the two compare directly.
 */
export const citedDomains = (runs: readonly CitedRun[], marks: ReadonlyMap<string, DomainMark> = new Map()) => {
  const threshold = Math.max(2, Math.min(3, Math.ceil(new Set(runs.map((run) => run.promptId)).size * 0.2)))
  const stats = new Map<string, { prompts: Set<string>; runs: number }>()
  for (const run of runs) {
    const domains = run.citations.filter((citation) => !citation.owned).map((citation) => citation.domain)
    for (const domain of new Set(domains)) {
      const row = stats.get(domain) ?? { prompts: new Set<string>(), runs: 0 }
      row.prompts.add(run.promptId)
      row.runs++
      stats.set(domain, row)
    }
  }
  return [...stats]
    .filter(([domain]) => marks.get(domain) !== 'HIDDEN')
    .map(([domain, row]) => {
      const marked = marks.get(domain) === 'COMPETITOR'
      const kind: 'COMPETITOR' | 'REFERENCE' | 'OTHER' =
        marked || (!isReferenceDomain(domain) && row.prompts.size >= threshold)
          ? 'COMPETITOR'
          : isReferenceDomain(domain)
            ? 'REFERENCE'
            : 'OTHER'
      return { domain, kind, marked, prompts: row.prompts.size, runs: row.runs, share: row.runs / runs.length }
    })
    .sort((a, b) => b.runs - a.runs || a.domain.localeCompare(b.domain))
}
