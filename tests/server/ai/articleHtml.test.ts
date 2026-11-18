import { describe, expect, it } from 'vitest'

import { repairArticleHtml } from '../../../server/utils/ai/articleHtml'

// The defects come from edit-list revisions in the opinion strength eval; each shipped as an approved article.
describe('repairArticleHtml', () => {
  it('returns sound content unchanged, byte for byte', () => {
    const html =
      '<h2>Heading</h2>\n<p>A paragraph with <a href="https://example.com/?a=1&amp;b=2">a link</a> and&nbsp;a space.</p>\n<ul><li>One</li><li>Two</li></ul>'
    expect(repairArticleHtml(html)).toBe(html)
  })

  it('wraps text an insertion left after a paragraph and drops the sentence it repeated', () => {
    const html =
      '<p>Count the people who will edit records. The distinction matters when plans limit seats or reserve useful features for higher tiers.</p>The distinction matters when plans limit seats or reserve useful features for higher tiers. HubSpot provides a concrete example. <a href="https://example.com/pricing">Check the seat requirement</a> when counting users.\n<h2>Set a budget</h2>'
    const repaired = repairArticleHtml(html)
    expect(repaired).toContain(
      '<p>HubSpot provides a concrete example. <a href="https://example.com/pricing">Check the seat requirement</a> when counting users.</p>',
    )
    expect(repaired.match(/The distinction matters/g)).toHaveLength(1)
    expect(repaired).toContain('<h2>Set a budget</h2>')
  })

  it('leaves bare slot markers between blocks, where the figures that fill them belong', () => {
    const html = '<h2>Pokuty</h2>[[VIDEO1]]<p>Text.</p>\n[[IMAGE1]] [[IMAGE2]]\n<p>Další.</p>[[QUIZ1]]'
    expect(repairArticleHtml(html)).toBe(html)
  })

  it('closes a paragraph the revision left open', () => {
    const html =
      '<ul><li>Vzduch–voda: strop je 350 000 Kč.</li></ul>\n<p>Jde o stropy bezúročného úvěru, nikoli o nevratný příspěvek. <a href="https://example.cz/">Oficiální přehled</a> využijte při sestavování rozpočtu.'
    const repaired = repairArticleHtml(html)
    expect(repaired).toMatch(/<p>Jde o stropy[\s\S]*rozpočtu\.<\/p>$/)
  })

  it('keeps the revised version of a paragraph the revision added a second time, in the first place', () => {
    const study = (url: string) =>
      `<p>A study by Emanuel, Harrington and Pallais of software engineers at one firm gives this concern a closer look, according to the <a href="${url}">research paper</a>.</p>`
    const html = `${study('https://old.example/paper.pdf')}<p>An earlier version found a feedback gap between office and remote teams.</p>${study('https://new.example/paper.pdf')}<p>That result helps explain the career effect.</p>`
    const repaired = repairArticleHtml(html)
    expect(repaired.match(/A study by Emanuel/g)).toHaveLength(1)
    expect(repaired).toContain('https://new.example/paper.pdf')
    expect(repaired).not.toContain('https://old.example/paper.pdf')
    expect(repaired.indexOf('A study by')).toBeLessThan(repaired.indexOf('An earlier version'))
  })

  it('wraps loose text inside a list as an item', () => {
    const repaired = repairArticleHtml('<ul><li>First option</li>Second option added by an edit</ul>')
    expect(repaired).toBe('<ul><li>First option</li><li>Second option added by an edit</li></ul>')
  })

  it('leaves a short repeated paragraph and an unrelated sentence alone', () => {
    const html = '<p>Shrnutí.</p><p>Text mezi nimi je dost dlouhý na to, aby nebyl jen opakováním.</p><p>Shrnutí.</p>'
    expect(repairArticleHtml(html)).toBe(html)
  })
})
