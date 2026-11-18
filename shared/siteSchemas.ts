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

/** Appearance collected before a blog exists; font uploads belong to settings after creation. */
export const BlogAppearanceSchema = z.object({
  theme: ThemeSchema.optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .or(z.literal(''))
    .nullable()
    .optional(),
  brandGradient: z
    .object({
      colors: z
        .array(z.string().regex(/^#[0-9a-f]{6}$/i))
        .min(2)
        .max(3),
      angle: z.number().int().min(0).max(360),
    })
    .strict()
    .nullable()
    .optional(),
  typographyPreset: z.enum(['MODERN', 'EDITORIAL', 'MAGAZINE', 'SYSTEM']).optional(),
  tagline: z.string().trim().max(80).optional(),
})
