import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Messages = Record<string, any>

const LOCALES = ['cs', 'en'] as const

const common = (locale: (typeof LOCALES)[number]): Messages =>
  JSON.parse(readFileSync(join(process.cwd(), `i18n/locales/${locale}/common.json`), 'utf8')).common

const values = (node: Messages): string[] =>
  Object.values(node).flatMap((child) => (typeof child === 'string' ? [child] : values(child as Messages)))

describe('wallet copy', () => {
  // The schema says token (tokenWallet, tokenRemaining, common.tokens.*), the UI says credit.
  // Copy that leaks the internal word forces the reader to map two names onto one balance.
  it.each(LOCALES)('%s calls the balance credit, never a token', (locale) => {
    const messages = common(locale)
    const leaked = [...values(messages.wallet), ...values(messages.tokens)].filter((value) => /token/i.test(value))
    expect(leaked).toEqual([])
  })

  it.each(LOCALES)('%s names the usage period instead of a timezone', (locale) => {
    expect(common(locale).wallet.periodUsage).toContain('{period}')
  })
})
