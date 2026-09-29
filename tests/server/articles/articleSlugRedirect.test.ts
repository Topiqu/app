import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ARTICLE_SLUG_MAX_LENGTH, articleSlug } from '../../../shared/utils/articleSlug'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('articleSlug', () => {
  it('normalizes like the editor and never ends on a cut hyphen', () => {
    expect(articleSlug('  Palkovice: proč se dům zasekne?  ')).toBe('palkovice-proc-se-dum-zasekne')
    const long = articleSlug(`${'a'.repeat(ARTICLE_SLUG_MAX_LENGTH - 1)} bcd`)
    expect(long.length).toBeLessThanOrEqual(ARTICLE_SLUG_MAX_LENGTH)
    expect(long.endsWith('-')).toBe(false)
    expect(articleSlug('!!!')).toBe('')
  })
})

describe('slug changes keep old links working', () => {
  const patch = read('server/api/articles/[id]/index.patch.ts')
  const get = read('server/api/articles/[id]/index.get.ts')
  const create = read('server/api/articles/index.post.ts')
  const page = read('app/pages/clanky/[slug].vue')

  it('records the previous slug only for an article readers could have seen', () => {
    expect(patch).toContain('body.slug = articleSlug(body.slug)')
    expect(create).toContain('articleSlug(String(body.slug || body.title')
    expect(patch).toMatch(/if \(previousSlug && previousArticle\.publishedAt\)\s+await tx\.articleSlugRedirect\.upsert/)
    expect(patch).toContain("statusCode: 409, message: t('articles.editor.slugConflict')")
  })

  it('answers an old slug with the new one and the page redirects permanently', () => {
    expect(get).toContain("redirect.article.status === 'published' || isAdmin")
    expect(get).toContain('data: { movedTo }')
    expect(page).toContain('redirectCode: 301')
  })
})
