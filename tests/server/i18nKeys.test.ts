import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const LOCALES = ['en', 'cs'] as const

/** `useServerI18n` merges every locale file into one object, so each file's own root is part of the key. */
const loadMessages = (locale: string) => {
  const dir = join(ROOT, 'i18n/locales', locale)
  const merged: Record<string, any> = {}
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')))
    Object.assign(merged, JSON.parse(readFileSync(join(dir, file), 'utf8')))
  return merged
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return path.endsWith('.ts') ? [path] : []
  })

const collectKeys = () => {
  const found: { key: string; where: string }[] = []
  for (const file of walk(join(ROOT, 'server'))) {
    const source = readFileSync(file, 'utf8')
    for (const [, key] of source.matchAll(/\b(?:t|translate)\(\s*'([a-zA-Z][\w.]*)'/g))
      found.push({ key, where: file.slice(ROOT.length + 1).replace(/\\/g, '/') })
  }
  return found
}

const resolveKey = (messages: Record<string, any>, key: string) =>
  key.split('.').reduce<any>((obj, part) => obj?.[part], messages)

describe('server translation keys', () => {
  const keys = collectKeys()

  it('finds keys to check', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  for (const locale of LOCALES) {
    it(`resolves every server t() key in ${locale}`, () => {
      const messages = loadMessages(locale)
      const missing = keys
        .filter(({ key }) => typeof resolveKey(messages, key) !== 'string')
        .map(({ key, where }) => `${key} (${where})`)

      expect(missing).toEqual([])
    })
  }
})
