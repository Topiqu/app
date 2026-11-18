import { describe, expect, it } from 'vitest'

import { normalizeBodyBlocks } from '../../../server/utils/ai/bodyBlocks'

const prosCons = (pros: string, cons: string) =>
  `<div data-type="pros-cons"><div data-side="pros">${pros}</div><div data-side="cons">${cons}</div></div>`

describe('normalizeBodyBlocks', () => {
  it('keeps well-formed blocks unchanged', () => {
    const html =
      '<aside data-type="callout" data-tone="warning"><p>Lhůta končí 30. 6.</p></aside>' +
      prosCons('<p>Výhody</p><ul><li>Levné</li></ul>', '<p>Nevýhody</p><ul><li>Pomalé</li></ul>') +
      '<table data-chart="bar"><tbody><tr><th>A</th><th>B</th></tr></tbody></table>'
    expect(normalizeBodyBlocks(html)).toBe(html)
  })

  it('repairs a callout tone and turns a heading inside it into a paragraph', () => {
    expect(normalizeBodyBlocks('<aside data-type="callout" data-tone="danger"><h3>Pozor</h3><p>Text</p></aside>')).toBe(
      '<aside data-type="callout" data-tone="note"><p>Pozor</p><p>Text</p></aside>',
    )
  })

  it('unwraps an aside that is not a callout and drops an empty callout', () => {
    expect(normalizeBodyBlocks('<aside><p>Bok</p></aside><aside data-type="callout"> </aside>')).toBe('<p>Bok</p>')
  })

  it('unwraps a pros/cons block the page could not render', () => {
    expect(normalizeBodyBlocks(prosCons('<ul><li>Levné</li></ul>', '<p>Nevýhody</p><ul><li>Pomalé</li></ul>'))).toBe(
      '<ul><li>Levné</li></ul><p>Nevýhody</p><ul><li>Pomalé</li></ul>',
    )
  })

  it('drops a CTA the writer wrote, since its link would be the model’s choice', () => {
    expect(
      normalizeBodyBlocks(
        '<p>a</p><div data-type="cta" data-url="https://x.test"><p><a href="https://x.test">Buy</a></p></div>',
      ),
    ).toBe('<p>a</p>')
  })

  it('removes an unknown chart kind but keeps the table', () => {
    expect(normalizeBodyBlocks('<table data-chart="pie"><tbody><tr><td>1</td></tr></tbody></table>')).toBe(
      '<table><tbody><tr><td>1</td></tr></tbody></table>',
    )
  })
})
