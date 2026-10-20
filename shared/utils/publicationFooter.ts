import { z } from 'zod'

import { isSafeWidgetLink } from './widgets'
import { hasAdvancedBranding } from './publicationBranding'

export const MAX_FOOTER_LINKS = 6

export const FooterSettingsSchema = z
  .object({
    enabled: z.boolean().default(true),
    text: z.string().trim().max(300).default(''),
    showSocials: z.boolean().default(false),
    links: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(60),
            url: z.string().trim().min(1).max(2048).refine(isSafeWidgetLink),
          })
          .strict(),
      )
      .max(MAX_FOOTER_LINKS)
      .default([]),
  })
  .strict()

export type FooterSettings = z.infer<typeof FooterSettingsSchema>

export const parseFooterSettings = (value: unknown): FooterSettings => {
  const result = FooterSettingsSchema.safeParse(value)
  return result.success ? result.data : FooterSettingsSchema.parse({})
}

/** Downgrading never hides the required Basic footer, even if paid settings are still stored. */
export const resolveFooterSettings = (value: unknown, plan?: string | null): FooterSettings =>
  hasAdvancedBranding(plan) ? parseFooterSettings(value) : FooterSettingsSchema.parse({})
