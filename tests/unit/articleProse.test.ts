import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ARTICLE_PROSE_CLASS, ARTICLE_TABLE_CLASS, EDITOR_TABLE_CLASS } from '../../shared/utils/articleProse'

describe('article prose presentation contract', () => {
  it('keeps publication typography responsive and dark-mode aware', () => {
    expect(ARTICLE_PROSE_CLASS).toContain('max-w-[68ch]')
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/\bprose(?:-|\b)/)
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/\bspace-y-/)
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/\bbg-white\b|\bshadow-|\bborder\b|\brounded-/)

    const css = readFileSync(resolve(process.cwd(), 'app/assets/styles/main.css'), 'utf8')
    expect(css).toMatch(/\.article-content h2\s*\{[^}]*margin-block: 3rem 1rem/s)
    expect(css).toMatch(/\.article-content h2\s*\{[^}]*font-size:/s)
    expect(css).toMatch(/\.article-content p\s*\{[^}]*margin-block: 1\.25rem/s)
  })

  it('renders wide publication logos without requesting a square crop', () => {
    const header = readFileSync(resolve(process.cwd(), 'app/components/Header.vue'), 'utf8')

    expect(header).toContain('aspectRatio="16 / 5"')
    expect(header).toContain('containerClass="h-10 w-32 shrink-0 bg-transparent"')
    expect(header).toContain(':width="128"')
    expect(header).not.toMatch(/:width="128"[\s\S]*?:height="128"/)
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
    const imageRule = page.match(/\.article-content p img\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(imageRule).not.toContain('opacity: 0')
    expect(imageRule).not.toContain('fade-in-image')
  })
})
