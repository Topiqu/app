import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { baseCompile } from '@intlify/message-compiler'

import { LANGUAGE_OPTIONS } from '../../shared/siteSchemas'

// vue-i18n compiles messages only when they are first rendered, so a stray `@` (linked-message syntax),
// an unbalanced brace or a broken placeholder from a machine translation would otherwise surface at runtime.
const localeRoot = join(process.cwd(), 'i18n/locales')

const strings = (value: unknown, prefix: string, result: [string, string][] = []) => {
  if (typeof value === 'string') result.push([prefix, value])
  else if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) strings(child, `${prefix}.${key}`, result)
  return result
}

const messagesOf = (language: string) =>
  [...readdirSync(join(localeRoot, language)).map((file) => `${language}/${file}`), `master_${language}.json`]
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => strings(JSON.parse(readFileSync(join(localeRoot, file), 'utf8')), file))

const keyCount = (value: unknown): number =>
  value && typeof value === 'object'
    ? Object.values(value).reduce<number>(
        (count, child) => count + keyCount(child),
        Array.isArray(value) ? 0 : Object.keys(value).length,
      )
    : 0

describe('i18n message syntax', () => {
  // `JSON.parse` keeps the last of two equal keys without a word, so the first translation silently
  // disappears. In valid JSON only a property name is followed by a colon.
  it('has no duplicate keys', () => {
    const files = [
      ...LANGUAGE_OPTIONS.flatMap((language) => readdirSync(join(localeRoot, language)).map((f) => `${language}/${f}`)),
      ...LANGUAGE_OPTIONS.map((language) => `master_${language}.json`),
    ].filter((file) => file.endsWith('.json'))
    const duplicated = files.filter((file) => {
      const raw = readFileSync(join(localeRoot, file), 'utf8')
      // Whole string tokens in order, so an escaped `\":` inside a value is never read as a key.
      const keys = [...raw.matchAll(/"(?:[^"\\]|\\.)*"(\s*:)?/g)].filter((match) => match[1]).length
      return keys !== keyCount(JSON.parse(raw))
    })

    expect(duplicated).toEqual([])
  })

  it.each(LANGUAGE_OPTIONS)('compiles every %s message', (language) => {
    const errors = messagesOf(language).flatMap(([key, message]) => {
      const found: string[] = []
      baseCompile(message, { onError: (error) => found.push(`${key}: ${error.message} in ${JSON.stringify(message)}`) })
      return found
    })

    expect(errors).toEqual([])
  })

  it('reports the mistakes it exists to catch', () => {
    const errorsIn = (message: string) => {
      const found: string[] = []
      baseCompile(message, { onError: (error) => found.push(error.message) })
      return found
    }
    expect(errorsIn('Napište na info@example.com')).not.toEqual([])
    expect(errorsIn('Hallo {name')).not.toEqual([])
    expect(errorsIn("Napište na info{'@'}example.com")).toEqual([])
  })
})
