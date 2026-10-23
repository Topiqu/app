import { createHash } from 'node:crypto'

export const WEBSITE_IMPORT_LIMITS = {
  searches: 2,
  pages: 5,
  pageBytes: 2 * 1024 * 1024,
  pageCharacters: 12_000,
  researchCharacters: 10_000,
  researchOutputTokens: 2000,
  extractionOutputTokens: 3000,
  timeoutMs: 90_000,
  leaseMs: 5 * 60_000,
  // Conservative reservation for hosted-search context, both model calls and bounded indexing.
  reservationMicros: 4_000_000,
  indexingMicros: 100_000,
} as const

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    )
  return value
}
export const websiteValueHash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stableValue(value ?? null)))
    .digest('hex')

export const websiteSnapshot = (site: {
  accentColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  keywords: unknown
  focus: string | null
  audience: string | null
  aiToneOfVoice: string | null
  language: WebsiteValues['language']
  socials: WebsiteValues['socials']
}): WebsiteValues => ({
  ...emptyWebsiteValues(),
  accentColor: site.accentColor,
  logoUrl: site.logoUrl,
  faviconUrl: site.faviconUrl,
  focus: site.focus,
  audience: site.audience,
  aiToneOfVoice: site.aiToneOfVoice,
  language: site.language,
  keywords: Array.isArray(site.keywords)
    ? site.keywords.filter((value): value is string => typeof value === 'string')
    : [],
  socials: site.socials
    .map(({ platform, url }) => ({ platform, url }))
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.url.localeCompare(b.url)),
})

export interface WebsiteUsage {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  searches: number | null
  estimatedCostMicros: number
  durationMs: number
}

export const websiteUsage = (
  usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number },
  providerMetadata: unknown,
  durationMs: number,
  search: boolean,
): WebsiteUsage | null => {
  if (
    !Number.isSafeInteger(usage.inputTokens) ||
    usage.inputTokens! < 0 ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.outputTokens! < 0
  )
    return null
  const metadata = providerMetadata as
    | {
        anthropic?: {
          usage?: {
            server_tool_use?: { web_search_requests?: number }
            cache_creation_input_tokens?: number
            cache_read_input_tokens?: number
          }
        }
      }
    | undefined
  const raw = metadata?.anthropic?.usage
  const searches = search ? raw?.server_tool_use?.web_search_requests : 0
  const knownSearches = Number.isSafeInteger(searches) && searches! >= 0 ? searches! : null
  const cachedInputTokens = raw?.cache_read_input_tokens ?? usage.cachedInputTokens ?? 0
  const cacheWriteTokens = raw?.cache_creation_input_tokens ?? 0
  if (![cachedInputTokens, cacheWriteTokens].every((value) => Number.isSafeInteger(value) && value >= 0)) return null
  // Haiku 5.5 direct API rate card, 2026-10-22; reserve 2x for cache writes and full price for reads.
  // https://platform.claude.com/docs/en/about-claude/pricing
  const inputTokens = usage.inputTokens!
  const outputTokens = usage.outputTokens!
  const high = inputTokens > 100_000
  const estimatedCostMicros = Math.ceil(
    (inputTokens + cacheWriteTokens) * (high ? 0.5 : 0.1) +
      outputTokens * (high ? 2.5 : 0.5) +
      (knownSearches ?? WEBSITE_IMPORT_LIMITS.searches) * 10_000,
  )
  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    searches: knownSearches,
    estimatedCostMicros,
    durationMs,
  }
}
