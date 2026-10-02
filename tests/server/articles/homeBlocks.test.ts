import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const series = source('server/api/series/by-clientsite/[slug].get.ts')
const discussions = source('server/api/comments/by-clientsite/[slug].get.ts')

describe('homepage series and discussions', () => {
  // Both payloads are shared through Redis, so they must be built without the caller's privileges
  // (an admin's enhanced client would read drafts into everyone's cached answer).
  it.each([
    ['series', series],
    ['discussions', discussions],
  ])('builds the cached %s list with the anonymous client', (_name, endpoint) => {
    expect(endpoint).toContain('const db = await getEnhancedPrisma()')
    expect(endpoint).toContain("status: 'published'")
    expect(endpoint).toContain('deletedAt: null')
  })

  it('adds reading progress outside the shared cache', () => {
    const cacheCall = series.indexOf('await cached(')
    expect(cacheCall).toBeGreaterThan(-1)
    expect(series.indexOf('getServerSession')).toBeGreaterThan(cacheCall)
    expect(series).toContain('sessionId: viewer')
  })

  it('hides discussions from banned users and sites with comments off', () => {
    expect(discussions).toContain('if (!clientSite.commentsEnabled) return []')
    expect(discussions).toMatch(/bans: \{\s*none:/)
  })
})
