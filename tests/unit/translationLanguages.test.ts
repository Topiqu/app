import { describe, expect, it } from 'vitest'

import {
  activeTranslationLanguages,
  extraLanguagesNeeded,
  MAX_TRANSLATION_LANGUAGES,
  translationLanguageLimit,
} from '../../shared/utils/translationLanguages'

describe('translation language allowance', () => {
  it('includes the plan languages plus bought ones', () => {
    expect(translationLanguageLimit({ plan: 'PRO', extraTranslationLanguages: 0 })).toBe(2)
    expect(translationLanguageLimit({ plan: 'PRO', extraTranslationLanguages: 3 })).toBe(5)
    expect(translationLanguageLimit({ plan: 'PREMIUM', extraTranslationLanguages: 1 })).toBe(6)
  })

  it('gives FREE nothing, even with a stale add-on count', () => {
    expect(translationLanguageLimit({ plan: 'BASIC', extraTranslationLanguages: 4 })).toBe(0)
  })

  it('never exceeds the languages there are to translate into', () => {
    expect(translationLanguageLimit({ plan: 'PREMIUM', extraTranslationLanguages: 50 })).toBe(MAX_TRANSLATION_LANGUAGES)
  })

  it('counts the add-ons a selection needs', () => {
    expect(extraLanguagesNeeded('PRO', 1)).toBe(0)
    expect(extraLanguagesNeeded('PRO', 4)).toBe(2)
    expect(extraLanguagesNeeded('BASIC', 4)).toBe(0)
  })
})

describe('active translation languages', () => {
  const site = { plan: 'PRO' as const, extraTranslationLanguages: 0, language: 'cs' as const }

  it('pauses the last-picked languages beyond the allowance', () => {
    expect(activeTranslationLanguages({ ...site, translationLanguages: ['de', 'es', 'pl', 'it'] })).toEqual([
      'de',
      'es',
    ])
  })

  it('ignores the site language and duplicates before counting', () => {
    expect(activeTranslationLanguages({ ...site, translationLanguages: ['cs', 'de', 'de', 'fr', 'nl'] })).toEqual([
      'de',
      'fr',
    ])
  })

  it('translates nothing when nothing is selected', () => {
    expect(activeTranslationLanguages({ ...site, translationLanguages: [] })).toEqual([])
  })
})
