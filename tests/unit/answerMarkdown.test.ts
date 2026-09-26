import { describe, expect, it } from 'vitest'

import { answerInline, parseAnswerMarkdown } from '../../shared/utils/answerMarkdown'

describe('AI answer markdown', () => {
  it('parses the block subset AI search answers use', () => {
    const blocks = parseAnswerMarkdown(
      '## Jak vybrat\n\nPro tento typ\nprojektu **celé řešení**.\n\n- rychlé\n- ověřené\n\n1. Návrh\n2. Schváleno\n\n---\n### B. Headless',
    )
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'rule', 'heading'])
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      inline: [{ text: 'Pro tento typ projektu ' }, { text: 'celé řešení', bold: true }, { text: '.' }],
    })
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: 'rychlé' }], [{ text: 'ověřené' }]] })
    expect(blocks[3]).toMatchObject({ ordered: true })
  })

  it('keeps http links without tracking params and drops unsafe schemes', () => {
    expect(answerInline('Zdroj ([reuters.com](https://reuters.com/a?utm_source=openai&id=1))')).toEqual([
      { text: 'Zdroj (' },
      { text: 'reuters.com', href: 'https://reuters.com/a?id=1' },
      { text: ')' },
    ])
    expect(answerInline('[klik](javascript:alert(1))')).toEqual([{ text: 'klik' }, { text: ')' }])
  })

  it('leaves an unclosed bold marker from a truncated answer as text', () => {
    expect(answerInline('**St')).toEqual([{ text: '**St' }])
  })
})
