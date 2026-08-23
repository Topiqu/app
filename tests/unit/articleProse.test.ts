import { describe, expect, it } from 'vitest'

import { ARTICLE_PROSE_CLASS, ARTICLE_TABLE_CLASS, EDITOR_TABLE_CLASS } from '../../shared/utils/articleProse'

describe('article prose presentation contract', () => {
  it('keeps publication typography responsive and dark-mode aware', () => {
    expect(ARTICLE_PROSE_CLASS).toContain('prose')
    expect(ARTICLE_PROSE_CLASS).toContain('max-w-[68ch]')
    expect(ARTICLE_PROSE_CLASS).toContain('dark:prose-invert')
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/\bspace-y-/)
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/\bbg-white\b|\bshadow-|\bborder\b|\brounded-/)
    expect(ARTICLE_PROSE_CLASS).toContain('prose-p:my-5')
    expect(ARTICLE_PROSE_CLASS).toContain('prose-h2:mt-12')
  })

  it('keeps rendered and editor tables horizontally safe', () => {
    expect(ARTICLE_TABLE_CLASS).toContain('overflow-x-auto')
    expect(EDITOR_TABLE_CLASS).toContain('overflow-x-auto')
  })
})
