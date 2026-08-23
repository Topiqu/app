import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const endpoint = readFileSync(resolve(process.cwd(), 'server/api/articles/[id]/translate.post.ts'), 'utf8')
const task = readFileSync(resolve(process.cwd(), 'server/tasks/translate-pending.ts'), 'utf8')

/**
 * `generateTranslation` translates and bills the extraction fields, but both write sites build
 * their own `data` object — dropping one costs the tokens and then renders the source language
 * under a translated body, which reads as a half-translated page rather than a missing feature.
 */
describe('ArticleTranslation write sites', () => {
  for (const [name, source] of [
    ['translate endpoint', endpoint],
    ['translate-pending cron', task],
  ] as const) {
    it(`${name} persists the translated extraction fields`, () => {
      for (const field of ['answer', 'keyTakeaways', 'faq']) {
        expect(source).toMatch(new RegExp(`${field}:\\s*translated\\.${field}`))
      }
    })
  }

  // The endpoint upserts, so a re-translation of an existing row goes through `update`.
  it('the endpoint persists them on both upsert branches', () => {
    expect(endpoint.match(/answer:\s*translated\.answer/g)).toHaveLength(2)
  })
})
