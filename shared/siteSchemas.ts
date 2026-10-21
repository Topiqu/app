import type { Language, Theme } from '../generated/zenstack/models'

import { z } from './utils/zod'

export const LANGUAGE_OPTIONS = ['en', 'cs', 'de', 'fr'] as const satisfies readonly Language[]
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
export const ThemeSchema = z.enum(THEME_OPTIONS)
