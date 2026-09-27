import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { LANGUAGE_OPTIONS } from '../../shared/siteSchemas'
import { AUTH_SEGMENTS, LOCALIZED_SEGMENTS } from '../../shared/utils/routes'
import { LANGUAGE_NAMES, LANGUAGE_TAGS, locales } from '../../shared/utils/language'

// `LANGUAGE_OPTIONS` is the one list; every other place that enumerates languages is checked against it,
// so adding a language fails here with a list of what is still missing.
const ROOT = process.cwd()
const languages = [...LANGUAGE_OPTIONS].sort()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const sorted = (values: Iterable<string>) => [...values].sort()

/** Returns the body of the `{…}` or `[…]` that opens at `start`, without executing the file. */
const block = (source: string, start: number) => {
  const open = source[start]!
  const close = open === '{' ? '}' : ']'
  let depth = 0
  for (let index = start; index < source.length; index++) {
    if (source[index] === open) depth++
    else if (source[index] === close && --depth === 0) return source.slice(start + 1, index)
  }
  throw new Error(`Unclosed ${open} at ${start}`)
}
const blockAfter = (source: string, marker: string) => {
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`${marker} not found`)
  return block(source, at + marker.length - 1)
}

const i18nConfig = blockAfter(read('nuxt.config.ts'), '\n  i18n: {')
const localeEntries = [...blockAfter(i18nConfig, 'locales: [').matchAll(/code: '(\w+)'/g)].map((match) => {
  const entry = block(i18nConfig, i18nConfig.lastIndexOf('{', i18nConfig.indexOf(match[0])))
  return {
    code: match[1]!,
    tag: entry.match(/language: '([^']+)'/)?.[1],
    files: sorted([...blockAfter(entry, 'files: [').matchAll(/'([^']+)'/g)].map((file) => file[1]!)),
  }
})

describe('language registry', () => {
  it('matches the Language enum in the schema', () => {
    const values = blockAfter(read('prisma/models/base.zmodel'), 'enum Language {').match(/\w+/g)
    expect(sorted(values ?? [])).toEqual(languages)
  })

  it('registers every language as an i18n locale with its BCP 47 tag', () => {
    expect(sorted(localeEntries.map((entry) => entry.code))).toEqual(languages)
    for (const { code, tag } of localeEntries) expect(tag, code).toBe(LANGUAGE_TAGS[code as keyof typeof LANGUAGE_TAGS])
  })

  it.each(LANGUAGE_OPTIONS)('loads exactly the message files that exist for %s', (language) => {
    const onDisk = readdirSync(join(ROOT, 'i18n/locales', language))
      .filter((file) => file.endsWith('.json'))
      .map((file) => `${language}/${file}`)
    const files = localeEntries.find((entry) => entry.code === language)?.files
    expect(files).toEqual(sorted([...onDisk, `master_${language}.json`]))
    for (const file of files ?? []) expect(existsSync(join(ROOT, 'i18n/locales', file)), file).toBe(true)
  })

  it('gives every localized page a path in every language', () => {
    const pages = blockAfter(i18nConfig, 'pages: {')
    const routes = [...pages.matchAll(/'?([\w-]+)'?: \{([^}]*)\}/g)]
    expect(routes.length).toBeGreaterThan(0)
    for (const [, route, paths] of routes)
      expect(sorted([...paths!.matchAll(/(\w+): '/g)].map((path) => path[1]!)), route).toEqual(languages)
  })

  it('keeps every language table in shared code complete', () => {
    const tables = {
      LANGUAGE_TAGS,
      LANGUAGE_NAMES,
      AUTH_SEGMENTS,
      ...Object.fromEntries(
        Object.entries(LOCALIZED_SEGMENTS).map(([kind, table]) => [`LOCALIZED_SEGMENTS.${kind}`, table]),
      ),
    }
    for (const [name, table] of Object.entries(tables)) expect(sorted(Object.keys(table)), name).toEqual(languages)
    expect(sorted(locales.map((locale) => locale.value)), 'locales').toEqual(languages)
  })

  it('defines number formats for every language', async () => {
    Object.assign(globalThis, { defineI18nConfig: (config: () => unknown) => config })
    const { default: config } = await import('../../i18n/i18n.config')
    const { numberFormats } = (config as unknown as () => { numberFormats: Record<string, unknown> })()
    expect(sorted(Object.keys(numberFormats))).toEqual(languages)
  })

  it('ships message, master and email files for every language and nothing else', () => {
    const directories = readdirSync(join(ROOT, 'i18n/locales'), { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    )
    expect(sorted(directories.map((entry) => entry.name))).toEqual(languages)
    expect(sorted(readdirSync(join(ROOT, 'i18n/locales')).filter((file) => file.startsWith('master_')))).toEqual(
      languages.map((language) => `master_${language}.json`),
    )
    expect(sorted(readdirSync(join(ROOT, 'emails/locales')))).toEqual(languages.map((language) => `${language}.json`))
  })

  it.each(LANGUAGE_OPTIONS)('names every language in %s', (language) => {
    const names = JSON.parse(read(`i18n/locales/${language}/languages.json`)).languages
    expect(sorted(Object.keys(names))).toEqual(languages)
  })
})
