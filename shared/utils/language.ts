import { LANGUAGE_OPTIONS } from '../siteSchemas'

export type Language = (typeof LANGUAGE_OPTIONS)[number]

export const LANGUAGE_TAGS: Record<Language, string> = {
  en: 'en-US',
  cs: 'cs-CZ',
  de: 'de-DE',
  fr: 'fr-FR',
}

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  cs: 'Czech',
  de: 'German',
  fr: 'French',
}

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && LANGUAGE_OPTIONS.some((language) => language === value)

export const languageTag = (value: unknown): string => (isLanguage(value) ? LANGUAGE_TAGS[value] : 'en-US')

export const locales: Array<{ icon: string; label: string; value: Language }> = [
  { icon: 'twemoji:flag-united-kingdom', label: 'English', value: 'en' },
  { icon: 'twemoji:flag-czechia', label: 'Čeština', value: 'cs' },
  { icon: 'twemoji:flag-germany', label: 'Deutsch', value: 'de' },
  { icon: 'twemoji:flag-france', label: 'Français', value: 'fr' },
]
