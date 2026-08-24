import type { ClientSite, SocialPlatform } from '@prisma/client'

export const PRIVILEGED_CLIENT_SITE_FIELDS = ['plan', 'tokenLimit'] as const

export const TENANT_EDITABLE_CLIENT_SITE_FIELDS = [
  'name',
  'domain',
  'generationFrequency',
  'keywords',
  'audience',
  'language',
  'theme',
  'focus',
  'description',
  'tagline',
  'logoUrl',
  'faviconUrl',
  'typographyPreset',
  'autoRelease',
  'gtagId',
  'allowGtag',
  'gamNetworkCode',
  'aiToneOfVoice',
  'aiControversyLevel',
  'translationMode',
  'translationLanguages',
  'discloseAiContent',
] as const

export const PUBLIC_CLIENT_SITE_FIELDS = [
  'id',
  'name',
  'domain',
  'domainVerified',
  'domainVerificationStatus',
  'domainLastCheckedAt',
  'domainVerificationError',
  'plan',
  'description',
  'tagline',
  'logoUrl',
  'faviconUrl',
  'typographyPreset',
  'keywords',
  'language',
  'theme',
  'currency',
  'gtagId',
  'allowGtag',
  'allowShapes',
  'discloseAiContent',
  'gamNetworkCode',
] as const

export const CLIENT_SITE_SECRET_FIELDS = [
  'apiKey',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'stripePriceId',
  'tokenLimit',
  'tokenRemaining',
  'totalUsage',
  'monthlyPayment',
  'annualPayment',
  'billingPlan',
  'firstPaidAt',
  'nextBillingAt',
  'lastInvoicedAt',
  'lastPaidAt',
  'communityInsight',
  'focus',
  'audience',
  'aiToneOfVoice',
  'aiControversyLevel',
  'humanHourlyRateUsd',
  'humanWordsPerHour',
] as const

export const pickFields = <T extends readonly string[]>(source: Record<string, unknown>, fields: T) =>
  Object.fromEntries(
    fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]),
  ) as Partial<Record<T[number], unknown>>

export const fieldMask = <T extends readonly string[]>(fields: T) =>
  Object.fromEntries(fields.map((field) => [field, true])) as { [K in T[number]]: true }

export const publicClientSiteSelect = {
  ...fieldMask(PUBLIC_CLIENT_SITE_FIELDS),
  // Feeds `Organization.sameAs`, on the payload the app already fetches.
  socials: { select: { platform: true, url: true } },
} as const

export type PublicClientSiteField = (typeof PUBLIC_CLIENT_SITE_FIELDS)[number]

export type PublicClientSite = Pick<ClientSite, PublicClientSiteField> & {
  socials: { platform: SocialPlatform; url: string }[]
}
