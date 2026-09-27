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

describe('i18n message syntax', () => {
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
