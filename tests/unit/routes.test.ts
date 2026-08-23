import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { articlePath, LOCALIZED_SEGMENTS, markdownPath, tagPath } from '../../shared/utils/routes'

const config = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')

/** Pulls one locale's path out of an `i18n.pages` entry without executing the config. */
const configuredPath = (routeName: string, locale: 'cs' | 'en') => {
  const block = config.match(new RegExp(`'?${routeName}'?:\\s*\\{([^}]*)\\}`))?.[1]
  return block?.match(new RegExp(`\\b${locale}:\\s*'([^']+)'`))?.[1]
}

/**
 * Nitro cannot call `localePath`, so `shared/utils/routes.ts` restates the segments. Renaming a
 * route in `nuxt.config.ts` without touching that file would silently point every sitemap entry,
 * feed link and llms.txt link at a 404 — this is the only thing standing between the two.
 */
describe('localized segments match nuxt.config', () => {
  it.each([
    ['clanky-slug', 'article'],
    ['stitky-slug', 'tag'],
    ['autor-name', 'author'],
  ] as const)('%s', (routeName, kind) => {
    for (const locale of ['cs', 'en'] as const) {
      const configured = configuredPath(routeName, locale)
      expect(configured, `${routeName}.${locale} missing from nuxt.config.ts`).toBeDefined()
      expect(configured!.split('/')[1]).toBe(LOCALIZED_SEGMENTS[kind][locale])
    }
  })
})

describe('public paths', () => {
  it('carries the locale prefix, since the strategy is `prefix`', () => {
    expect(articlePath('cs', 'muj-clanek')).toBe('/cs/clanky/muj-clanek')
    expect(articlePath('en', 'my-post')).toBe('/en/articles/my-post')
    expect(tagPath('cs', 'ai')).toBe('/cs/stitky/ai')
  })

  it('encodes slugs so a diacritic or a slash cannot break out of the segment', () => {
    expect(articlePath('cs', 'češtin a/b')).toBe('/cs/clanky/%C4%8De%C5%A1tin%20a%2Fb')
  })

  it('prefixes the markdown variant instead of suffixing the page URL', () => {
    expect(markdownPath('cs', 'muj-clanek')).toBe('/md/cs/clanky/muj-clanek.md')
  })
})
