import type { ClientPlan, Language } from '~~/generated/zenstack/models'

import { LANGUAGE_OPTIONS } from '../siteSchemas'

/** Translation languages a plan includes; more are bought one by one. FREE has no AI, so none. */
export const INCLUDED_TRANSLATION_LANGUAGES: Record<ClientPlan, number> = {
  BASIC: 0,
  PRO: 2,
  PREMIUM: 5,
  CUSTOM: 5,
}

export const EXTRA_TRANSLATION_LANGUAGE_PRICE_USD = 9
/** Every content language except the site's own. */
export const MAX_TRANSLATION_LANGUAGES = LANGUAGE_OPTIONS.length - 1

export type TranslationAllowanceSite = {
  plan: ClientPlan
  extraTranslationLanguages: number
}

export const translationLanguageLimit = ({ plan, extraTranslationLanguages }: TranslationAllowanceSite): number =>
  plan === 'BASIC'
    ? 0
    : Math.min(MAX_TRANSLATION_LANGUAGES, INCLUDED_TRANSLATION_LANGUAGES[plan] + Math.max(0, extraTranslationLanguages))

/** How many add-on languages a selection needs on top of the plan. */
export const extraLanguagesNeeded = (plan: ClientPlan, selected: number): number =>
  plan === 'BASIC' ? 0 : Math.max(0, selected - INCLUDED_TRANSLATION_LANGUAGES[plan])

/**
 * The languages that actually translate: the stored order decides which survive a downgrade, so a
 * shrunken allowance pauses the last-picked languages instead of rewriting the tenant's choice.
 */
export const activeTranslationLanguages = (
  site: TranslationAllowanceSite & { language: Language; translationLanguages: readonly Language[] },
): Language[] =>
  [...new Set(site.translationLanguages)]
    .filter((language) => language !== site.language)
    .slice(0, translationLanguageLimit(site))
