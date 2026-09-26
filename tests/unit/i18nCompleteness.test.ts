import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

import { optimizationRuleIds } from '../../shared/utils/articleOptimization'

type Messages = Record<string, unknown>

const flatten = (value: Messages, prefix = '', result = new Set<string>()) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child as Messages, path, result)
    else result.add(path)
  }
  return result
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Messages
const localeRoot = join(process.cwd(), 'i18n/locales')

const messagesFor = (locale: 'cs' | 'en') => {
  const messages = new Set<string>()
  const files = readdirSync(join(localeRoot, locale)).filter((file) => file.endsWith('.json'))
  for (const file of files) flatten(readJson(join(localeRoot, locale, file)), '', messages)
  flatten(readJson(join(localeRoot, `master_${locale}.json`)), '', messages)
  return messages
}

const vueFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith('.vue') ? [path] : []
  })

describe('locale completeness', () => {
  const english = messagesFor('en')
  const czech = messagesFor('cs')

  it('keeps Czech and English message keys in sync', () => {
    expect([...english].filter((key) => !czech.has(key))).toEqual([])
    expect([...czech].filter((key) => !english.has(key))).toEqual([])
  })

  it('resolves every statically referenced translation key', () => {
    const missing = vueFiles(join(process.cwd(), 'app')).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return [...source.matchAll(/(?<![\w$])(?:\$t|t)\(\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1] ?? '')
        .filter((key) => key && !english.has(key))
        .map((key) => `${path.replace(`${process.cwd()}/`, '')}: ${key}`)
    })

    expect(missing).toEqual([])
  })

  it('explains every article optimization check in actionable language', () => {
    for (const locale of ['cs', 'en'] as const) {
      const messages = readJson(join(localeRoot, locale, 'articles.json'))
      const articles = messages.articles as Messages
      const editor = articles.editor as Messages
      const optimization = editor.optimization as Messages
      const checks = optimization.checks as Record<
        string,
        { title: string; description: string; recommendation: string }
      >

      for (const id of optimizationRuleIds) {
        expect(checks[id].title).not.toBe(id)
        expect(checks[id].description.length).toBeGreaterThan(20)
        expect(checks[id].recommendation.length).toBeGreaterThan(20)
      }
    }
  })

  it.each(['cs', 'en'] as const)('translates every tenant scope in %s', (locale) => {
    const common = readJson(join(localeRoot, locale, 'common.json')).common as Messages
    const scopes = (common.members as Messages).scopes as Messages
    expect(Object.keys(scopes)).toEqual([
      'ARTICLE_WRITE',
      'ARTICLE_WRITE_OTHERS',
      'ARTICLE_PUBLISH',
      'MEMBER_CONTROL',
      'TENANT_SETTINGS',
      'INTEGRATION_CONTROL',
      'BILLING_CHANGE',
      'API_KEY_CONTROL',
      'AI_USE',
      'ANALYTICS_READ',
      'CONTENT_MODERATE',
    ])
    expect(Object.values(scopes).every((label) => typeof label === 'string' && label.length > 3)).toBe(true)
  })
})
