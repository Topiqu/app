import type { Language, Theme, UiLanguage } from '../generated/zenstack/models'

import { z } from './utils/zod'

/** The interface (dashboard, emails, server messages) is fully translated into these. */
export const UI_LANGUAGE_OPTIONS = ['en', 'cs', 'de', 'fr'] as const satisfies readonly UiLanguage[]
/** Content languages: sites, articles and translations. Readers get the public blog in each of them. */
export const LANGUAGE_OPTIONS = [
  ...UI_LANGUAGE_OPTIONS,
  'es',
  'it',
  'pl',
  'sk',
  'nl',
  'pt',
] as const satisfies readonly Language[]
export const THEME_OPTIONS = [
  'blue',
  'green',
  'red',
  'purple',
  'orange',
  'teal',
  'yellow',
  'pink',
  'indigo',
  'gray',
  'lime',
  'sky',
  'amber',
  'cyan',
  'violet',
] as const satisfies readonly Theme[]

export const LanguageSchema = z.enum(LANGUAGE_OPTIONS)
export const UiLanguageSchema = z.enum(UI_LANGUAGE_OPTIONS)
export const ThemeSchema = z.enum(THEME_OPTIONS)
