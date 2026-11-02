import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { AUTH_SEGMENTS, LOCALIZED_SEGMENTS } from '../../shared/utils/routes'
import { LANGUAGE_OPTIONS, UI_LANGUAGE_OPTIONS } from '../../shared/siteSchemas'
import {
  contentLanguages,
  LANGUAGE_NAMES,
  LANGUAGE_NATIVE_NAMES,
  LANGUAGE_TAGS,
  locales,
} from '../../shared/utils/language'

// Two lists: `LANGUAGE_OPTIONS` (content: sites, articles, the public blog) and `UI_LANGUAGE_OPTIONS` (the
// whole interface). Every place that enumerates languages is checked against the right one, so adding a
// language fails here with a list of what is still missing.
const ROOT = process.cwd()
const languages = [...LANGUAGE_OPTIONS].sort()
const uiLanguages = [...UI_LANGUAGE_OPTIONS].sort()
const contentOnly = LANGUAGE_OPTIONS.filter((language) => !uiLanguages.includes(language))
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
  it('matches the Language and UiLanguage enums in the schema', () => {
    const schema = read('prisma/models/base.zmodel')
    expect(sorted(blockAfter(schema, 'enum Language {').match(/\w+/g) ?? [])).toEqual(languages)
    expect(sorted(blockAfter(schema, 'enum UiLanguage {').match(/\w+/g) ?? [])).toEqual(uiLanguages)
  })

  it('registers every language as an i18n locale with its BCP 47 tag', () => {
    expect(sorted(localeEntries.map((entry) => entry.code))).toEqual(languages)
    for (const { code, tag } of localeEntries) expect(tag, code).toBe(LANGUAGE_TAGS[code as keyof typeof LANGUAGE_TAGS])
  })

  it.each(UI_LANGUAGE_OPTIONS)('loads exactly the message files that exist for %s', (language) => {
    const onDisk = readdirSync(join(ROOT, 'i18n/locales', language))
      .filter((file) => file.endsWith('.json'))
      .map((file) => `${language}/${file}`)
    const files = localeEntries.find((entry) => entry.code === language)?.files
    expect(files).toEqual(sorted([...onDisk, `master_${language}.json`]))
    for (const file of files ?? []) expect(existsSync(join(ROOT, 'i18n/locales', file)), file).toBe(true)
  })

  it.each(contentOnly)('loads only the reader subset for content-only %s', (language) => {
    expect(localeEntries.find((entry) => entry.code === language)?.files).toEqual([`${language}/reader.json`])
    expect(readdirSync(join(ROOT, 'i18n/locales', language))).toEqual(['reader.json'])
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
      LANGUAGE_NATIVE_NAMES,
      ...Object.fromEntries(
        Object.entries(LOCALIZED_SEGMENTS).map(([kind, table]) => [`LOCALIZED_SEGMENTS.${kind}`, table]),
      ),
    }
    for (const [name, table] of Object.entries(tables)) expect(sorted(Object.keys(table)), name).toEqual(languages)
    expect(sorted(contentLanguages.map((language) => language.value)), 'contentLanguages').toEqual(languages)
    // Sign-in and the interface pickers exist only in the interface languages.
    expect(sorted(Object.keys(AUTH_SEGMENTS)), 'AUTH_SEGMENTS').toEqual(uiLanguages)
    expect(sorted(locales.map((locale) => locale.value)), 'locales').toEqual(uiLanguages)
  })

  it('defines number formats for every language', async () => {
    Object.assign(globalThis, { defineI18nConfig: (config: () => unknown) => config })
    const { default: config } = await import('../../i18n/i18n.config')
    const { numberFormats } = (config as unknown as () => { numberFormats: Record<string, unknown> })()
    expect(sorted(Object.keys(numberFormats))).toEqual(languages)
  })

  it('ships a message directory for every language, master and email files for the interface ones', () => {
    const directories = readdirSync(join(ROOT, 'i18n/locales'), { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    )
    expect(sorted(directories.map((entry) => entry.name))).toEqual(languages)
    expect(sorted(readdirSync(join(ROOT, 'i18n/locales')).filter((file) => file.startsWith('master_')))).toEqual(
      uiLanguages.map((language) => `master_${language}.json`),
    )
    expect(sorted(readdirSync(join(ROOT, 'emails/locales')))).toEqual(uiLanguages.map((language) => `${language}.json`))
  })

  it.each(UI_LANGUAGE_OPTIONS)('names every language in %s', (language) => {
    const names = JSON.parse(read(`i18n/locales/${language}/languages.json`)).languages
    expect(sorted(Object.keys(names))).toEqual(languages)
  })
})
