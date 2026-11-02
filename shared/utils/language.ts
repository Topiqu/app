import { LANGUAGE_OPTIONS, UI_LANGUAGE_OPTIONS } from '../siteSchemas'

export type Language = (typeof LANGUAGE_OPTIONS)[number]
export type UiLanguage = (typeof UI_LANGUAGE_OPTIONS)[number]

// `pt` is European Portuguese and `es` Spain's Spanish: the writer, the keyword market and the
// hreflang tag must agree on one variant. Brazil or Latin America would be their own languages.
export const LANGUAGE_TAGS: Record<Language, string> = {
  en: 'en-US',
  cs: 'cs-CZ',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pl: 'pl-PL',
  sk: 'sk-SK',
  nl: 'nl-NL',
  pt: 'pt-PT',
}

/** Names the AI prompts use. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  cs: 'Czech',
  de: 'German',
  fr: 'French',
  es: 'Spanish (Spain)',
  it: 'Italian',
  pl: 'Polish',
  sk: 'Slovak',
  nl: 'Dutch',
  pt: 'European Portuguese',
}

export const LANGUAGE_NATIVE_NAMES: Record<Language, string> = {
  en: 'English',
  cs: 'Čeština',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pl: 'Polski',
  sk: 'Slovenčina',
  nl: 'Nederlands',
  pt: 'Português',
}

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && LANGUAGE_OPTIONS.some((language) => language === value)

export const isUiLanguage = (value: unknown): value is UiLanguage =>
  typeof value === 'string' && UI_LANGUAGE_OPTIONS.some((language) => language === value)

/** A reader on a content-only locale still gets server messages, emails and links in a real UI language. */
export const uiLanguageOf = (value: unknown, fallback: UiLanguage = 'en'): UiLanguage =>
  isUiLanguage(value) ? value : fallback

export const languageTag = (value: unknown): string => (isLanguage(value) ? LANGUAGE_TAGS[value] : 'en-US')

/** Interface language pickers. */
export const locales: Array<{ label: string; value: UiLanguage }> = UI_LANGUAGE_OPTIONS.map((value) => ({
  label: LANGUAGE_NATIVE_NAMES[value],
  value,
}))

/** Content language pickers: the site's language, translations, knowledge sources. */
export const contentLanguages: Array<{ label: string; value: Language }> = LANGUAGE_OPTIONS.map((value) => ({
  label: LANGUAGE_NATIVE_NAMES[value],
  value,
}))
