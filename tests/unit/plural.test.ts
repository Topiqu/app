import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import csCommon from '../../i18n/locales/cs/common.json'
import csArticles from '../../i18n/locales/cs/articles.json'
import deArticles from '../../i18n/locales/de/articles.json'
import enArticles from '../../i18n/locales/en/articles.json'
import frArticles from '../../i18n/locales/fr/articles.json'
import { czechPluralIndex } from '../../shared/utils/plural'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enArticles, cs: csArticles, de: deArticles, fr: frArticles },
  pluralRules: { cs: czechPluralIndex },
})

const t = (locale: 'en' | 'cs' | 'de' | 'fr', count: number) => {
  i18n.global.locale.value = locale
  return i18n.global.t('articles.articlesCount', count, { count })
}

describe('czechPluralIndex', () => {
  it('maps counts onto the four Czech forms', () => {
    expect(czechPluralIndex(0)).toBe(0)
    expect(czechPluralIndex(1)).toBe(1)
    expect([2, 3, 4].map((count) => czechPluralIndex(count))).toEqual([2, 2, 2])
    expect([5, 11, 21, 100].map((count) => czechPluralIndex(count))).toEqual([3, 3, 3, 3])
  })

  it('keeps the shared rule and self-contained Nuxt runtime config identical', async () => {
    vi.stubGlobal('defineI18nConfig', (config: () => unknown) => config)
    try {
      const { default: config } = await import('../../i18n/i18n.config')
      const runtime = (config as unknown as () => { pluralRules: { cs: typeof czechPluralIndex } })().pluralRules.cs
      for (const forms of [1, 2, 3, 4])
        for (const count of [0, 1, 2, 4, 5, 12, 25]) expect(runtime(count, forms)).toBe(czechPluralIndex(count, forms))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('renders three-form credit labels and two-form copy without crashing the settings page', () => {
    const { global } = createI18n({
      legacy: false,
      locale: 'cs',
      pluralRules: { cs: czechPluralIndex },
      messages: { cs: { ...csCommon, pair: 'Jedna položka | Více položek' } },
    })
    for (const count of [0, 1, 2, 4, 5, 12, 25]) {
      expect(global.t('common.articlePacks.articles', count)).toMatch(/kredit/)
      expect(global.t('common.wallet.unit', count)).toMatch(/kredit/)
      expect(global.t('pair', count)).toBe(count === 1 ? 'Jedna položka' : 'Více položek')
    }
  })
})

describe('articles.articlesCount', () => {
  it('resolves every Czech form', () => {
    expect(t('cs', 0)).toBe('Zatím žádné články')
    expect(t('cs', 1)).toBe('1 článek')
    expect(t('cs', 3)).toBe('3 články')
    expect(t('cs', 12)).toBe('12 článků')
  })

  it('resolves every English form', () => {
    expect(t('en', 0)).toBe('No articles yet')
    expect(t('en', 1)).toBe('1 article')
    expect(t('en', 7)).toBe('7 articles')
  })

  it('resolves German and French article counts', () => {
    expect(t('de', 0)).toBe('Noch keine Artikel')
    expect(t('de', 1)).toBe('1 Artikel')
    expect(t('de', 7)).toBe('7 Artikel')
    expect(t('fr', 0)).toBe('Aucun article pour le moment')
    expect(t('fr', 1)).toBe('1 article')
    expect(t('fr', 7)).toBe('7 articles')
  })
})
