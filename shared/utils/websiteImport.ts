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

export const WebsiteResultSchema = z.object({
  values: WebsiteValuesSchema,
  sources: z.array(z.object({ url: publicUrl, title: z.string().max(200) })).max(5),
  warnings: z.array(z.enum(['pageFailed', 'knowledgeQuota', 'assetUnavailable', 'analysisFailed'])).max(4),
})
export type WebsiteImportResult = z.infer<typeof WebsiteResultSchema>

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
