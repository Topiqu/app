import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { LanguageSchema } from '../../../shared/siteSchemas'
import { BIO_MAX_LENGTH } from '../../../shared/utils/profile'

describe('user PATCH language', () => {
  // A free string would pass validation and then fail in Postgres as an invalid enum value (500, not 400).
  it('validates against the supported languages', () => {
    const patch = readFileSync(resolve(process.cwd(), 'server/api/users/[id]/index.patch.ts'), 'utf8')

    expect(patch).toContain('language: LanguageSchema.optional(),')
    expect(LanguageSchema.safeParse('de').success).toBe(true)
    expect(LanguageSchema.safeParse('xx').success).toBe(false)
  })
})

describe('user PATCH bio', () => {
  // The textarea's maxlength is a hint; an over-long body must be a 400 here, not a DB error.
  it('caps the bio at the length the profile form counts against', () => {
    const patch = readFileSync(resolve(process.cwd(), 'server/api/users/[id]/index.patch.ts'), 'utf8')
    const zmodel = readFileSync(resolve(process.cwd(), 'prisma/models/user.zmodel'), 'utf8')

    expect(patch).toContain('bio: z.string().max(BIO_MAX_LENGTH).nullable().optional(),')
    expect(zmodel).toMatch(new RegExp(`bio\\s+String\\?\\s+@length\\(0, ${BIO_MAX_LENGTH},`))
  })
})
