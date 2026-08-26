import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
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
    const css = readFileSync(resolve(process.cwd(), 'app/assets/styles/main.css'), 'utf8')

    expect(ARTICLE_TABLE_CLASS).toContain('overflow-x-auto')
    expect(ARTICLE_TABLE_CLASS).toContain('article-table')
    expect(EDITOR_TABLE_CLASS).toContain('editor-table')
    expect(css).toContain('.article-table th,')
    expect(css).toContain('.editor-table .ProseMirror .tableWrapper')
    expect(css).toContain('padding: 0.75rem 1rem')
  })

  it('does not leave inline article images permanently transparent', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/pages/clanky/[slug].vue'), 'utf8')
    const imageRule = page.match(/\.prose p img\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(imageRule).not.toContain('opacity: 0')
    expect(imageRule).not.toContain('fade-in-image')
  })
})
