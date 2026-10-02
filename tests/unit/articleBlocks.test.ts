import { describe, expect, it } from 'vitest'

import { AD_MIN_PARAGRAPHS, headingSlug } from '../../shared/utils/articleBlocks'
import { articleBlocks, stampHeadingIds } from '../../server/utils/articleBlocks'

describe('headingSlug', () => {
  it('keeps Czech letters as their base form', () => {
    expect(headingSlug('Přehled trhu')).toBe('prehled-trhu')
    expect(headingSlug('Co je to čeština?')).toBe('co-je-to-cestina')
  })

  it('trims separators and caps the source length', () => {
    expect(headingSlug('  — Hello, World! —  ')).toBe('hello-world')
    expect(headingSlug('a'.repeat(80))).toHaveLength(50)
  })
})

describe('articleBlocks', () => {
  it('returns the body as SSR-ready HTML', () => {
    const { blocks } = articleBlocks('<h2>Nadpis</h2><p>Text</p>')

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: 'html' })
    expect((blocks[0] as { html: string }).html).toContain('Text')
  })

  it('merges adjacent nodes into one run so prose sibling rules still apply', () => {
    const { blocks } = articleBlocks('<p>a</p><p>b</p><p>c</p>')

    expect(blocks).toHaveLength(1)
    expect((blocks[0] as { html: string }).html).toBe('<p>a</p><p>b</p><p>c</p>')
  })

  it('stamps anchor ids and reports the headings', () => {
    const { blocks, headings } = articleBlocks('<h2>Prvni cast</h2><p>x</p><h3>Druha</h3>')

    expect(headings).toEqual([
      { id: 'prvni-cast', text: 'Prvni cast', level: 2 },
      { id: 'druha', text: 'Druha', level: 3 },
    ])
    expect((blocks[0] as { html: string }).html).toContain('<h2 id="prvni-cast">')
  })

  it('keeps an id the body already carries', () => {
    const { headings, blocks } = articleBlocks('<h2 id="legacy-anchor">Nadpis</h2>')

    expect(headings[0]!.id).toBe('legacy-anchor')
    expect((blocks[0] as { html: string }).html).toContain('id="legacy-anchor"')
  })

  it('disambiguates repeated headings', () => {
    const { headings } = articleBlocks('<h2>Shrnuti</h2><h2>Shrnuti</h2><h2>Shrnuti</h2>')

    expect(headings.map((h) => h.id)).toEqual(['shrnuti', 'shrnuti-2', 'shrnuti-3'])
  })

  it('splits a poll into its own block', () => {
    const options = JSON.stringify([{ id: 'o1', label: 'Ano' }])
    const html = `<p>pred</p><div data-type="poll" data-poll-id="p1" data-question="Otazka?" data-options='${options}'></div><p>po</p>`

    const { blocks } = articleBlocks(html)

    expect(blocks.map((b) => b.type)).toEqual(['html', 'poll', 'html'])
    expect(blocks[1]).toMatchObject({ pollId: 'p1', question: 'Otazka?' })
  })

  it('degrades an unstamped poll to raw HTML rather than an unvotable widget', () => {
    const { blocks } = articleBlocks('<div data-type="poll" data-question="Otazka?"></div>')

    expect(blocks.map((b) => b.type)).toEqual(['html'])
  })

  it('wraps tables so they escape the prose typography', () => {
    const { blocks } = articleBlocks('<table><tbody><tr><td>a</td></tr></tbody></table>')

    expect((blocks[0] as { html: string }).html).toContain('not-prose')
  })

  it('is empty for empty content', () => {
    expect(articleBlocks('')).toEqual({ blocks: [], headings: [] })
    expect(articleBlocks(null)).toEqual({ blocks: [], headings: [] })
  })
})

describe('stampHeadingIds', () => {
  it('agrees with the render-time builder', () => {
    const stamped = stampHeadingIds('<h2>Přehled trhu</h2><h3>Přehled trhu</h3>')

    expect(stamped).toContain('<h2 id="prehled-trhu">')
    expect(stamped).toContain('<h3 id="prehled-trhu-2">')
    expect(articleBlocks(stamped).headings.map((h) => h.id)).toEqual(['prehled-trhu', 'prehled-trhu-2'])
  })
})

describe('in-body ad break', () => {
  const p = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `<p>p${from + i}</p>`).join('')
  const types = (content: string) => articleBlocks(content, { adBreak: true }).blocks.map((block) => block.type)
  const htmlAround = (content: string) => {
    const { blocks } = articleBlocks(content, { adBreak: true })
    const at = blocks.findIndex((block) => block.type === 'ad')
    return [blocks[at - 1], blocks[at + 1]].map((block) => (block as { html: string }).html)
  }

  it('is opt-in, so the editor preview and the poll lookup never see it', () => {
    expect(articleBlocks(p(10)).blocks.map((block) => block.type)).toEqual(['html'])
  })

  it('skips short articles', () => {
    expect(types(p(AD_MIN_PARAGRAPHS - 1))).toEqual(['html'])
  })

  it('goes before the second chapter heading when both sides carry text', () => {
    const [before, after] = htmlAround(`<h2>A</h2>${p(3)}<h2>B</h2>${p(3, 4)}`)
    expect(before).toMatch(/<p>p3<\/p>$/)
    expect(after).toMatch(/^<h2[^>]*>B<\/h2>/)
  })

  it('falls back to ~40 % of the paragraphs, never right after a heading', () => {
    const [before, after] = htmlAround(`<h2>A</h2>${p(1)}<h2>B</h2>${p(9, 2)}`)
    expect(before).toMatch(/<p>p4<\/p>$/)
    expect(after).toMatch(/^<p>p5<\/p>/)
  })

  it('places exactly one ad', () => {
    expect(types(p(30)).filter((type) => type === 'ad')).toHaveLength(1)
  })
})
