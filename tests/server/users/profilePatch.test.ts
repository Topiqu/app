import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { LanguageSchema } from '../../../shared/siteSchemas'

describe('user PATCH language', () => {
  // A free string would pass validation and then fail in Postgres as an invalid enum value (500, not 400).
  it('validates against the supported languages', () => {
    const patch = readFileSync(resolve(process.cwd(), 'server/api/users/[id]/index.patch.ts'), 'utf8')

    expect(patch).toContain('language: LanguageSchema.optional(),')
    expect(LanguageSchema.safeParse('de').success).toBe(true)
    expect(LanguageSchema.safeParse('xx').success).toBe(false)
  })
})
