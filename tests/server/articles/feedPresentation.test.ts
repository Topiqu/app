import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const feed = source('server/api/articles/by-clientsite/[slug].ts')
const featured = source('server/api/articles/featured/[slug].ts')

describe('homepage feed presentation', () => {
  it.each([
    ['feed', feed],
    ['featured', featured],
  ])('gives %s cards the current viewer reaction', (_name, endpoint) => {
    expect(endpoint).toContain("where: user?.id ? { userId: user.id } : { id: '' }")
    expect(endpoint).toContain('likedByUser: reactions.length > 0')
    expect(endpoint).toContain('({ reactions, ...article })')
  })

  // The viewer-scoped reaction above is only safe because the shared cache is never reached with a
  // session. Widening either condition would serve one reader's likes to everyone.
  it('keeps the shared cache on the anonymous branch only', () => {
    expect(feed).toContain('if (user || search) return buildFeed()')
    expect(featured).toContain('if (user) return buildFeatured()')
  })
})
