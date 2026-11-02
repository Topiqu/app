import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Messages = Record<string, any>

const LOCALES = ['cs', 'en', 'de', 'fr'] as const

const common = (locale: (typeof LOCALES)[number]): Messages =>
  JSON.parse(readFileSync(join(process.cwd(), `i18n/locales/${locale}/common.json`), 'utf8')).common

const values = (node: Messages): string[] =>
  Object.values(node).flatMap((child) => (typeof child === 'string' ? [child] : values(child as Messages)))

describe('wallet copy', () => {
  // Quality prices are stated once, on the quality picker (`ArticleQuality.vue`), not repeated in billing.
  it.each(LOCALES)('%s calls the allowance credits and prices each quality where it is chosen', (locale) => {
    const messages = common(locale)
    const leaked = [...values(messages.wallet), ...values(messages.articlePacks)].filter((value) =>
      /token/i.test(value),
    )
    expect(leaked).toEqual([])
    expect(messages.wallet.unit).toMatch(/credit|kredit|crédit/i)
    expect(messages.preferences.articleQuality.cost).toContain('{count}')
    expect(messages.articlePacks.pack25).toMatch(/25.*(credit|kredit|crédit)/i)
  })

  it.each(LOCALES)('%s names the usage period instead of a timezone', (locale) => {
    expect(common(locale).wallet.periodUsage).toContain('{period}')
  })
})
