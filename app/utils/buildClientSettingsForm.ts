import type { ThemeSchema, LanguageSchema } from '~~/shared/siteSchemas'
import type { SocialPlatform, ClientSite as _ClientSite } from '~~/generated/zenstack/models'

import equal from 'fast-deep-equal'
import { parseBrandGradient, type BrandGradient } from '~~/shared/utils/publicationBranding'
import { releaseScheduleSettings, type ReleaseScheduleSettings } from '~~/shared/utils/releaseSchedule'
import { publicationChannelSettings, type PublicationChannelSettings } from '~~/shared/utils/publicationChannels'

export interface ClientSite extends Omit<
  _ClientSite,
  'billingPlan' | 'nextBillingAt' | 'lastGeneratedAt' | 'nextReleaseAt'
> {
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT' | null
  nextBillingAt: string | null
  lastGeneratedAt: string | null
  nextReleaseAt: string | null
  activeFeatures: string[] | null
  keywords: string[] | null
  allowedFeatures: {
    AI?: boolean
    SENTIMENT?: boolean
    ARTICLE_CRONS?: boolean
  } | null
  socials: { platform: SocialPlatform; url: string }[]
  apiKey: string | null
  aiUser: { username: string; bio: string; avatarUrl: string } | null
  aiToneOfVoice: string | null
  aiControversyLevel: string | null
  linkedinCompanies?: { linkedinOrgId: string }[]
  articlesRemaining?: number
  articleWallet?: { balance: number; reserved: number; available: number } | null
}

export interface ClientSettingsForm extends PublicationChannelSettings, ReleaseScheduleSettings {
  focus: string
  audience: string
  language: (typeof LanguageSchema.options)[number]
  theme: (typeof ThemeSchema.options)[number]
  accentColor: string
  brandGradient: BrandGradient | null
  keywords: string[]
  description: string
  tagline: string
  logoUrl: string
  faviconUrl: string
  typographyPreset: 'MODERN' | 'EDITORIAL' | 'SYSTEM' | 'MAGAZINE' | 'CUSTOM'
  headingFontUrl: string
  bodyFontUrl: string
  optimizedUrl: string
  socials: { platform: SocialPlatform; url: string }[]
  aiUser: { username: string; bio: string; avatarUrl: string; optimizedAvatarUrl: string }
  aiToneOfVoice: string
  aiControversyLevel: string
  gtagId: string
  gamNetworkCode: string
  apiKey: string
  autoRelease: boolean
  commentsEnabled: boolean
  commentGifsEnabled: boolean
  aiSeriesEnabled: boolean
  generationFrequency: 'DAILY' | 'WEEKLY' | 'INTERVAL' | 'NONE'
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
  translationLanguages: string[]
  discloseAiContent: boolean
  allowGtag: boolean
  linkedinMode: 'HitL' | 'FullAuto'
  linkedinCompanyType: 'pages' | 'personal'
}

const emptyForm = (): ClientSettingsForm => ({
  focus: '',
  audience: '',
  language: 'en',
  theme: 'blue',
  accentColor: '',
  brandGradient: null,
  keywords: [],
  description: '',
  tagline: '',
  logoUrl: '',
  faviconUrl: '',
  typographyPreset: 'MODERN',
  headingFontUrl: '',
  bodyFontUrl: '',
  optimizedUrl: '',
  socials: [],
  aiUser: { username: '', bio: '', avatarUrl: '', optimizedAvatarUrl: '' },
  aiToneOfVoice: '',
  aiControversyLevel: '',
  gtagId: '',
  gamNetworkCode: '',
  apiKey: '',
  autoRelease: false,
  commentsEnabled: true,
  commentGifsEnabled: true,
  ...publicationChannelSettings(),
  aiSeriesEnabled: false,
  generationFrequency: 'NONE',
  ...releaseScheduleSettings(),
  translationMode: 'OFF',
  translationLanguages: [],
  discloseAiContent: false,
  allowGtag: false,
  linkedinMode: 'HitL',
  linkedinCompanyType: 'pages',
})

export function buildClientSettingsForm(client?: ClientSite | null): ClientSettingsForm {
  const base = emptyForm()
  if (!client) return base

  const linkedin =
    (client as { linkedinCompanies?: unknown[] }).linkedinCompanies?.[0] ??
    (client as { linkedinCompany?: unknown }).linkedinCompany
  const li = linkedin as
    | {
        mode?: 'HitL' | 'FullAuto'
        type?: 'pages' | 'personal'
      }
    | undefined

  return {
    ...base,
    focus: client.focus ?? '',
    audience: client.audience ?? '',
    language: client.language,
    theme: client.theme,
    accentColor: client.accentColor ?? '',
    brandGradient: parseBrandGradient(client.brandGradient),
    description: client.description ?? '',
    tagline: client.tagline ?? '',
    logoUrl: client.logoUrl ?? '',
    faviconUrl: client.faviconUrl ?? '',
    typographyPreset: client.typographyPreset ?? 'MODERN',
    headingFontUrl: client.headingFontUrl ?? '',
    bodyFontUrl: client.bodyFontUrl ?? '',
    keywords: client.keywords ?? [],
    socials: client.socials ?? [],
    apiKey: client.apiKey ?? '',
    aiUser: {
      username: client.aiUser?.username ?? '',
      bio: client.aiUser?.bio ?? '',
      avatarUrl: client.aiUser?.avatarUrl ?? '',
      optimizedAvatarUrl: '',
    },
    aiToneOfVoice: client.aiToneOfVoice ?? '',
    aiControversyLevel: client.aiControversyLevel ?? '',
    gtagId: client.gtagId ?? '',
    gamNetworkCode: client.gamNetworkCode ?? '',
    autoRelease: client.autoRelease ?? false,
    commentsEnabled: client.commentsEnabled ?? true,
    commentGifsEnabled: client.commentGifsEnabled ?? true,
    ...publicationChannelSettings(client),
    aiSeriesEnabled: client.aiSeriesEnabled ?? false,
    generationFrequency: client.generationFrequency ?? 'NONE',
    ...releaseScheduleSettings(client),
    translationMode: client.translationMode ?? 'OFF',
    translationLanguages: client.translationLanguages ?? [],
    discloseAiContent: client.discloseAiContent ?? false,
    allowGtag: client.allowGtag ?? false,
    linkedinMode: li?.mode ?? 'HitL',
    linkedinCompanyType: li?.type ?? 'pages',
  }
}

// Send only changes so unrelated settings do not trigger integration permission checks.
export function buildClientSettingsPatch(form: ClientSettingsForm, pristine: ClientSettingsForm) {
  const patch = Object.fromEntries(
    Object.entries(form).filter(([key, value]) => !equal(value, pristine[key as keyof ClientSettingsForm])),
  ) as Partial<ClientSettingsForm>
  if (patch.socials) patch.socials = patch.socials.filter((social) => social.url.trim())
  return patch
}
