import { describe, expect, it } from 'vitest'

import { readFaq } from '../../shared/utils/articleFaq'
import { contentToMarkdown } from '../../server/utils/articleMarkdown'

describe('contentToMarkdown', () => {
  it('maps headings to their level', () => {
    expect(contentToMarkdown('<h2>Nadpis</h2><h3>Podnadpis</h3>')).toBe('## Nadpis\n\n### Podnadpis')
  })

  it('keeps emphasis and links', () => {
    expect(contentToMarkdown('<p>A <strong>b</strong> and <a href="https://x.dev">c</a></p>')).toBe(
      'A **b** and [c](https://x.dev)',
    )
  })

  it('renders nested lists with indentation', () => {
    const html = '<ul><li>one<ul><li>deeper</li></ul></li><li>two</li></ul>'
    expect(contentToMarkdown(html)).toBe('- one\n  - deeper\n- two')
  })

  it('numbers ordered lists', () => {
    expect(contentToMarkdown('<ol><li>first</li><li>second</li></ol>')).toBe('1. first\n2. second')
  })

  it('builds a table with a header separator', () => {
    const html =
      '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    expect(contentToMarkdown(html)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })

  it('flattens a poll into its question and options', () => {
    const options = JSON.stringify([{ label: 'Ano' }, { label: 'Ne' }])
    const html = `<div data-type="poll" data-question="Otazka?" data-options='${options}'></div>`

    expect(contentToMarkdown(html)).toBe('**Otazka?**\n- Ano\n- Ne')
  })

  it('is empty for empty content', () => {
    expect(contentToMarkdown('')).toBe('')
    expect(contentToMarkdown(null)).toBe('')
  })
})

describe('readFaq', () => {
  it('accepts well-formed entries', () => {
    expect(readFaq([{ question: 'q', answer: 'a' }])).toEqual([{ question: 'q', answer: 'a' }])
  })

  it('drops anything that is not a question/answer pair', () => {
    expect(readFaq([{ question: 'q' }, null, 'text', { question: 1, answer: 2 }])).toEqual([])
    expect(readFaq(null)).toEqual([])
    expect(readFaq({})).toEqual([])
  })
})
