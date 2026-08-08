import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ARTICLE_PROSE_CLASS } from '../../shared/utils/articleProse'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('ARTICLE_PROSE_CLASS', () => {
  it('carries both themes, so a preview is not light-only', () => {
    expect(ARTICLE_PROSE_CLASS).toContain('prose')
    expect(ARTICLE_PROSE_CLASS).toContain('dark:prose-invert')
    expect(ARTICLE_PROSE_CLASS).toContain('bg-white')
    expect(ARTICLE_PROSE_CLASS).toContain('dark:bg-neutral-900')
  })

  it('collapses to a single line of classes', () => {
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/[\n\r]/)
    expect(ARTICLE_PROSE_CLASS.split(' ').filter(Boolean).length).toBeGreaterThan(10)
  })

  // The editor preview is only a preview while it renders the body through the same container
  // as the published page. Inlining the classes back into either file silently ends that.
  it.each([
    ['app/pages/clanky/[slug].vue', 'the published article'],
    ['app/components/Article/Editor/Preview.vue', 'the editor preview'],
  ])('is the single source of the body container in %s', (path) => {
    const source = read(path)

    expect(source).toContain('ARTICLE_PROSE_CLASS')
    expect(source).not.toContain('prose prose-gray')
  })
})
