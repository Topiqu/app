import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createGenerator } from 'unocss'

import unoConfig from '../../uno.config'
import { ARTICLE_PROSE_CLASS, ARTICLE_TABLE_CLASS, EDITOR_TABLE_CLASS } from '../../shared/utils/articleProse'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

/** A variant UnoCSS cannot parse emits nothing and fails silently in the browser. */
const tokensWithoutCss = async (classes: string) => {
  const uno = await createGenerator(unoConfig)
  const dead: string[] = []

  for (const token of classes.split(' ').filter(Boolean)) {
    const { css } = await uno.generate(token, { preflights: false })
    if (!css.trim()) dead.push(token)
  }

  return dead
}

describe('ARTICLE_PROSE_CLASS', () => {
  it('carries both themes, so a preview is not light-only', () => {
    expect(ARTICLE_PROSE_CLASS).toContain('prose')
    expect(ARTICLE_PROSE_CLASS).toContain('dark:prose-invert')
    expect(ARTICLE_PROSE_CLASS).toContain('bg-white')
    expect(ARTICLE_PROSE_CLASS).toContain('dark:bg-neutral-900')
  })

  // One knob. Re-adding a per-item margin makes the marker offset the sum of two rules again.
  it('indents lists from the list, not the item', async () => {
    expect(ARTICLE_PROSE_CLASS).not.toContain('prose-li:ml-')

    const uno = await createGenerator(unoConfig)
    const { css } = await uno.generate(ARTICLE_PROSE_CLASS, { preflights: false })

    expect(css).toMatch(/:where\(ul\)[^{]*\{[^}]*padding-inline-start:/)
    expect(css).toMatch(/:where\(ol\)[^{]*\{[^}]*padding-inline-start:/)
  })

  // Inert today only because `Article/Parsed.vue` renders a single root: `space-y-*` needs two
  // direct children. Its selector is 0,3,0 against prose's 0,2,0, so re-adding it the day that
  // root is flattened would outrank every margin below — a h2 would space like a paragraph.
  it('leaves the vertical rhythm to prose', () => {
    expect(ARTICLE_PROSE_CLASS).not.toMatch(/\bspace-y-/)
  })

  // The blank `<p></p>` the editor emits. It was the body's only spacing while base.scss's global
  // `* { margin: 0 }` stood unopposed; against real prose margins it stopped self-collapsing and
  // each blank line cost a line box plus two margins on top.
  it('drops the editor blank lines', async () => {
    const uno = await createGenerator(unoConfig)
    const { css } = await uno.generate(ARTICLE_PROSE_CLASS, { preflights: false })

    expect(css).toMatch(/p:empty\{display:none/)
  })

  // Preset defaults are sized for a 65ch essay: 2em around an image, 3em around a rule.
  it('tightens the block margins the preset sizes for a wider column', () => {
    expect(ARTICLE_PROSE_CLASS).toContain('prose-img:my-6')
    expect(ARTICLE_PROSE_CLASS).toContain('prose-hr:my-10')
  })

  it('emits CSS for every token', async () => {
    expect(await tokensWithoutCss(ARTICLE_PROSE_CLASS)).toEqual([])
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

  // The class list only earns its CSS if UnoCSS scans the file it lives in. Vite's pipeline
  // skips plain .ts, so the DRY refactor above is exactly what can silently un-style the body.
  it('is inside a path uno.config tells the pipeline to scan', () => {
    const include = unoConfig.content!.pipeline!.include as RegExp[]

    expect(include.some((pattern) => pattern.test('shared/utils/articleProse.ts'))).toBe(true)
  })

  it('generates the table rules the AI writer emits', async () => {
    const uno = await createGenerator(unoConfig)
    const { css } = await uno.generate(ARTICLE_PROSE_CLASS, { preflights: false })

    expect(css).toContain('--un-prose-th-borders')
    expect(css).toMatch(/:where\(thead th\)[^{]*\{[^}]*border:/)
    expect(css).toMatch(/:where\(tbody td\)[^{]*\{[^}]*border:/)
    // Per-cell borders without this double up on every shared edge.
    expect(css).toMatch(/:where\(table\)[^{]*\{[^}]*border-collapse:\s*collapse/)
  })
})

describe('table classes', () => {
  // The whole point of the wrapper: prose selectors are specificity 0,0,0, so the preset's own
  // later rules win on source order. `not-prose` is the documented opt-out; winning that race by
  // out-ordering the preset's internal selectors is not a contract we can rely on.
  it('opts the published table out of prose', () => {
    expect(ARTICLE_TABLE_CLASS).toContain('not-prose')
    expect(ARTICLE_TABLE_CLASS).toContain('overflow-x-auto')
  })

  it('styles cells identically in both surfaces', () => {
    for (const shared of ['[&_th]:px-3.5', '[&_td]:px-3.5', '[&_table]:border-collapse']) {
      expect(ARTICLE_TABLE_CLASS).toContain(shared)
      expect(EDITOR_TABLE_CLASS).toContain(shared)
    }
  })

  it('covers the chrome only TipTap emits', () => {
    expect(EDITOR_TABLE_CLASS).toContain('.tableWrapper')
    expect(EDITOR_TABLE_CLASS).toContain('.selectedCell')
    expect(EDITOR_TABLE_CLASS).toContain('.column-resize-handle')
  })

  it.each([
    ['ARTICLE_TABLE_CLASS', ARTICLE_TABLE_CLASS],
    ['EDITOR_TABLE_CLASS', EDITOR_TABLE_CLASS],
  ])('emits CSS for every token in %s', async (_label, classes) => {
    expect(await tokensWithoutCss(classes)).toEqual([])
  })

  it('carries both themes', () => {
    expect(ARTICLE_TABLE_CLASS).toContain('dark:')
    expect(EDITOR_TABLE_CLASS).toContain('dark:')
  })
})
