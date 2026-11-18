import { describe, expect, it } from 'vitest'

import { ctaHtml } from '../../shared/utils/articleEmbeds'
import { sanitizeHtml } from '../../server/utils/sanitize'

// Every write path runs the body through `sanitizeHtml`; a block it strips would vanish on save.
describe('sanitizeHtml and body blocks', () => {
  it('keeps the markup of callouts, pros/cons, CTAs, quizzes and chart marks', () => {
    const html =
      '<aside data-type="callout" data-tone="tip"><p>Tip</p></aside>' +
      '<div data-type="pros-cons"><div data-side="pros"><p>Výhody</p><ul><li><p>A</p></li></ul></div>' +
      '<div data-side="cons"><p>Nevýhody</p><ul><li><p>B</p></li></ul></div></div>' +
      ctaHtml({ title: 'T', text: 'X', label: 'L', url: 'https://firma.test/', tone: 'accent' }) +
      '<div data-type="quiz" data-poll-id="q" data-question="Q" data-options="[]" data-explanation="E"></div>' +
      '<table data-chart="bar"><tbody><tr><td>1</td></tr></tbody></table>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('still strips a script link from a CTA fallback', () => {
    const html = ctaHtml({ title: 'T', text: '', label: 'L', url: 'javascript:alert(1)', tone: 'accent' })
    expect(sanitizeHtml(html)).not.toContain('href="javascript:')
  })
})
