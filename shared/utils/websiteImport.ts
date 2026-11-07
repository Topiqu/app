import { z } from './zod'
import { LANGUAGE_OPTIONS } from '../siteSchemas'

export const WEBSITE_IMPORT_CONSENT_VERSION = 1
export const WEBSITE_IMPORT_FIELDS = [
  'accentColor',
  'logoUrl',
  'faviconUrl',
  'keywords',
  'focus',
  'audience',
  'aiToneOfVoice',
  'language',
  'socials',
  'knowledge',
] as const
export type WebsiteImportField = (typeof WEBSITE_IMPORT_FIELDS)[number]

const publicUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
  })

export const WebsiteSocialSchema = z.object({
  platform: z.enum(['FACEBOOK', 'TWITTER', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'OTHER']),
  url: publicUrl.max(255),
})
export const WebsiteValuesSchema = z.object({
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable(),
  logoUrl: publicUrl.nullable(),
  faviconUrl: publicUrl.nullable(),
  keywords: z.array(z.string().min(1).max(80)).max(12),
  focus: z.string().min(1).max(1000).nullable(),
  audience: z.string().min(1).max(1000).nullable(),
  aiToneOfVoice: z.string().min(1).max(500).nullable(),
  language: z.enum(LANGUAGE_OPTIONS).nullable(),
  socials: z.array(WebsiteSocialSchema).max(8),
})
export type WebsiteValues = z.infer<typeof WebsiteValuesSchema>

/** A first-article idea from the website, the same shape as an article batch topic. */
export const WebsiteTopicSchema = z.object({ topic: z.string().min(10).max(300), reason: z.string().min(10).max(300) })
export type WebsiteTopic = z.infer<typeof WebsiteTopicSchema>
export const WEBSITE_TOPICS_MAX = 3

export const WebsiteResultSchema = z.object({
  values: WebsiteValuesSchema,
  sources: z.array(z.object({ url: publicUrl, title: z.string().max(200) })).max(5),
  warnings: z.array(z.enum(['pageFailed', 'knowledgeQuota', 'assetUnavailable', 'analysisFailed'])).max(4),
  // Imports before topics have none; a required field would fail their whole result, review included.
  topics: z.array(WebsiteTopicSchema).max(WEBSITE_TOPICS_MAX).default([]),
})
export type WebsiteImportResult = z.infer<typeof WebsiteResultSchema>

export const WEBSITE_IMPORT_STEPS = ['address', 'search', 'pages', 'brand', 'analysis'] as const
export type WebsiteImportStep = (typeof WEBSITE_IMPORT_STEPS)[number]
export const WEBSITE_IMPORT_STEP_STATES = ['running', 'done', 'warning', 'failed', 'waiting'] as const
export type WebsiteImportStepState = (typeof WEBSITE_IMPORT_STEP_STATES)[number]
// `errorCode` of a queued import says what it waits for; of a failed one, why it stopped. Each has panel copy.
export const WEBSITE_IMPORT_WAIT_CODES = [
  'DAILY_BUDGET',
  'AI_UNAVAILABLE',
  'AI_PLAN_REQUIRED',
  'AI_ALLOWANCE_EXHAUSTED',
  'PROVIDER_OVERLOADED',
] as const
export const WEBSITE_IMPORT_ERROR_CODES = [
  'AI_UNAVAILABLE',
  'URL_UNREACHABLE',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_OVERLOADED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_REJECTED',
  'PROVIDER_FAILED',
  'SEARCH_OUTCOME_UNKNOWN',
  'ANALYSIS_OUTCOME_UNKNOWN',
  'NO_CONTENT',
  'RETRY_LIMIT',
] as const

export const WebsiteProgressSchema = z.object({
  steps: z.partialRecord(
    z.enum(WEBSITE_IMPORT_STEPS),
    z.object({
      state: z.enum(WEBSITE_IMPORT_STEP_STATES),
      at: z.string().max(40),
      count: z.number().int().min(0).optional(),
      code: z.string().max(64).optional(),
    }),
  ),
  pages: z.array(z.object({ url: publicUrl, state: z.enum(['done', 'failed']) })).max(5),
})
export type WebsiteImportProgress = z.infer<typeof WebsiteProgressSchema>

export const emptyWebsiteValues = (): WebsiteValues => ({
  accentColor: null,
  logoUrl: null,
  faviconUrl: null,
  keywords: [],
  focus: null,
  audience: null,
  aiToneOfVoice: null,
  language: null,
  socials: [],
})

export const normalizeWebsiteUrl = (value: string): string | null => {
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(url.hostname)) return null
    if (/\.(?:local|internal|home|test|invalid|example)$/i.test(url.hostname)) return null
    if ([...url.searchParams.keys()].some((key) => /token|secret|password|auth|session|key/i.test(key))) return null
    url.protocol = 'https:'
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key)
    }
    return url.href
  } catch {
    return null
  }
}

export const isWebsitePage = (value: string, website: string) => {
  const normalized = normalizeWebsiteUrl(value)
  if (!normalized) return false
  const url = new URL(normalized)
  const host = (input: URL) => input.hostname.replace(/^www\./, '')
  return (
    host(url) === host(new URL(website)) &&
    !/(?:^|\/)(?:admin|login|sign-in|account|checkout|cart|search|wp-admin)(?:\/|$)/i.test(url.pathname) &&
    ![...url.searchParams.keys()].some((key) => /^(?:s|q|search|sort|filter|page|add-to-cart)$/i.test(key))
  )
}

export interface WebsiteImportView {
  id: string
  sourceUrl: string
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'REVIEWED' | 'FAILED'
  result: WebsiteImportResult | null
  current: WebsiteValues
  expected: Partial<Record<WebsiteImportField, string>>
  knowledge: { id: string; title: string; sourceUrl: string | null; status: string }[]
  acceptedFields: WebsiteImportField[]
  errorCode: string | null
  progress: WebsiteImportProgress | null
}

export interface WebsiteImportResponse {
  websiteUrl: string | null
  import: WebsiteImportView | null
}

export const hasWebsiteImportValue = (field: WebsiteImportField, values: WebsiteValues, knowledgeCount = 0) => {
  if (field === 'knowledge') return knowledgeCount > 0
  const value = values[field]
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim().length > 0
}
