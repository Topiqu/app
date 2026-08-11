import type { ClientSite } from '@prisma/client'

export const PRIVILEGED_CLIENT_SITE_FIELDS = ['plan', 'tokenLimit', 'gamNetworkCode', 'allowAds'] as const

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
  'aiToneOfVoice',
  'aiControversyLevel',
  'translationMode',
  'translationLanguages',
] as const

export const PUBLIC_CLIENT_SITE_FIELDS = [
  'id',
  'name',
  'domain',
  'domainVerified',
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
  'allowAds',
  'allowShapes',
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
  'humanHourlyRate',
  'humanWordsPerHour',
] as const

export const fieldMask = <T extends readonly string[]>(fields: T) =>
  Object.fromEntries(fields.map((field) => [field, true])) as { [K in T[number]]: true }

export const publicClientSiteSelect = fieldMask(PUBLIC_CLIENT_SITE_FIELDS)

export type PublicClientSiteField = (typeof PUBLIC_CLIENT_SITE_FIELDS)[number]

export type PublicClientSite = Pick<ClientSite, PublicClientSiteField>
