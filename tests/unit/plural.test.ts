import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import csArticles from '../../i18n/locales/cs/articles.json'
import enArticles from '../../i18n/locales/en/articles.json'
import { czechPluralIndex } from '../../shared/utils/plural'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enArticles, cs: csArticles },
  pluralRules: { cs: czechPluralIndex },
})

const t = (locale: 'en' | 'cs', count: number) => {
  i18n.global.locale.value = locale
  return i18n.global.t('articles.articlesCount', count, { count })
}

describe('czechPluralIndex', () => {
  it('maps counts onto the four Czech forms', () => {
    expect(czechPluralIndex(0)).toBe(0)
    expect(czechPluralIndex(1)).toBe(1)
    expect([2, 3, 4].map(czechPluralIndex)).toEqual([2, 2, 2])
    expect([5, 11, 21, 100].map(czechPluralIndex)).toEqual([3, 3, 3, 3])
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
})
