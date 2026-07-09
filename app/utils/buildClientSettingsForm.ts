import type { ThemeSchema, LanguageSchema } from '~~/shared/zod/enums'
import type { SocialPlatform, ClientSite as _ClientSite } from '@prisma/client'

export interface ClientSite
  extends Omit<_ClientSite, 'billingPlan' | 'nextBillingAt' | 'lastGeneratedAt' | 'lastTokenRefilled'> {
  billingPlan: 'MONTHLY' | 'ANNUAL' | 'PERMANENT' | null
  nextBillingAt: string | null
  lastGeneratedAt: string | null
  lastTokenRefilled: string | null
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
}

export interface ClientSettingsForm {
  focus: string
  audience: string
  language: (typeof LanguageSchema.options)[number]
  theme: (typeof ThemeSchema.options)[number]
  keywords: string[]
  description: string
  logoUrl: string
  optimizedUrl: string
  socials: { platform: SocialPlatform; url: string }[]
  aiUser: { username: string; bio: string; avatarUrl: string; optimizedAvatarUrl: string }
  aiToneOfVoice: string
  aiControversyLevel: string
  gtagId: string
  gamNetworkCode: string
  allowAds: boolean
  apiKey: string
  autoRelease: boolean
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
  translationLanguages: string[]
  allowGtag: boolean
  linkedinMode: 'HitL' | 'FullAuto'
  linkedinBrandProfile: { tone: string; audience: string; doList: string[]; dontList: string[] }
  linkedinCompanyType: 'pages' | 'personal'
}

const emptyForm = (): ClientSettingsForm => ({
  focus: '',
  audience: '',
  language: 'en',
  theme: 'blue',
  keywords: [],
  description: '',
  logoUrl: '',
  optimizedUrl: '',
  socials: [],
  aiUser: { username: '', bio: '', avatarUrl: '', optimizedAvatarUrl: '' },
  aiToneOfVoice: '',
  aiControversyLevel: '',
  gtagId: '',
  gamNetworkCode: '',
  allowAds: false,
  apiKey: '',
  autoRelease: false,
  translationMode: 'OFF',
  translationLanguages: [],
  allowGtag: false,
  linkedinMode: 'HitL',
  linkedinBrandProfile: { tone: '', audience: '', doList: [], dontList: [] },
  linkedinCompanyType: 'pages',
})

export function buildClientSettingsForm(client?: ClientSite | null): ClientSettingsForm {
  const base = emptyForm()
  if (!client) return base

  const linkedin =
    (client as { linkedinCompanies?: unknown[] }).linkedinCompanies?.[0] ??
    (client as { linkedinCompany?: unknown }).linkedinCompany
  const li = linkedin as
    | { mode?: 'HitL' | 'FullAuto'; type?: 'pages' | 'personal'; brandProfile?: ClientSettingsForm['linkedinBrandProfile'] }
    | undefined

  return {
    ...base,
    focus: client.focus ?? '',
    audience: client.audience ?? '',
    language: client.language,
    theme: client.theme,
    description: client.description ?? '',
    logoUrl: client.logoUrl ?? '',
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
    translationMode: client.translationMode ?? 'OFF',
    translationLanguages: client.translationLanguages ?? [],
    allowAds: client.allowAds,
    allowGtag: client.allowGtag ?? false,
    linkedinMode: li?.mode ?? 'HitL',
    linkedinBrandProfile: li?.brandProfile ?? { tone: '', audience: '', doList: [], dontList: [] },
    linkedinCompanyType: li?.type ?? 'pages',
  }
}
