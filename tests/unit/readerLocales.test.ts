// @vitest-environment node
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { CONTENT_ONLY_LOCALES, leaves, localeMessages, readerKeys } from '../../scripts/reader-i18n'

const reader = (locale: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'i18n/locales', locale, 'reader.json'), 'utf8'))
const at = (messages: Record<string, unknown>, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages)
const placeholders = (message: string) => new Set(message.match(/\{[^}]*\}/g) ?? [])

const keys = readerKeys()
const english = localeMessages('en')

/**
 * A content-only locale falls back to English for anything it lacks, so a key added to a public
 * component would silently show English on a Spanish blog. Translate it in every `reader.json`.
 */
describe.each(CONTENT_ONLY_LOCALES)('%s reader messages', (locale) => {
  const messages = reader(locale)

  it('covers exactly the keys the public pages use', () => {
    expect(new Set(leaves(messages))).toEqual(keys)
  })

  it('keeps every placeholder', () => {
    for (const key of keys) {
      const source = at(english, key) as string
      const translated = at(messages, key) as string
      expect(placeholders(translated), `${locale}: ${key}`).toEqual(placeholders(source))
    }
  })

  it('never contains a bare @, which breaks the production build', () => {
    for (const key of keys) expect(at(messages, key), `${locale}: ${key}`).not.toMatch(/(^|[^{'])@/)
  })
})
