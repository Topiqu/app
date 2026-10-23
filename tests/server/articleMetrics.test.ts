import { describe, expect, it } from 'vitest'

import { calculateArticleMetrics } from '../../server/utils/metrics'

describe('stored article HTML metrics', () => {
  it.each([
    ['', 0],
    ['<p>První odstavec.</p><p>Druhý odstavec.</p>', 4],
    ['<p>Slou<strong>čené</strong> slovo a <a href="https://example.invalid/long/path">viditelný odkaz</a>.</p>', 5],
    ['<p>A&nbsp;B &#269;eské &amp; slovenské slová.</p>', 6],
    [
      '<script>Hidden words here</script><style>.hidden { color: red }</style><template>Also hidden</template><p>Visible text.</p>',
      2,
    ],
    ['<table><tr><td>One</td><td>Two</td></tr><tr><td>Three</td><td>Four</td></tr></table>', 4],
    [
      '<p>One<br>Two<br/>Three</p><!-- hidden words --><img alt="not visible metadata" src="https://example.invalid/x.jpg">',
      3,
    ],
    ['Plain Czech text bez HTML.', 5],
  ])('counts readable text and keeps block boundaries: %s', (content, count) => {
    const metrics = calculateArticleMetrics(content, 40, 400)
    expect(metrics.totalWords).toBe(count)
    expect(metrics.readingTime).toBe(Math.ceil(count / 200))
    expect(metrics.savedTimeMinutes).toBe(Math.round((count / 400) * 60))
    expect(metrics.savedAmount).toBe(Number(((count / 400) * 40).toFixed(2)))
  })

  it('uses the same 200-word reading boundary for long articles', () => {
    expect(calculateArticleMetrics(`<p>${'word '.repeat(200)}</p>`, 40, 400).readingTime).toBe(1)
    expect(calculateArticleMetrics(`<p>${'word '.repeat(201)}</p>`, 40, 400).readingTime).toBe(2)
  })

  it('includes the question and options rendered by a saved poll', () => {
    const content = `<div data-type="poll" data-poll-id="poll-1" data-question="Chcete český čaj?" data-options='[{"id":"yes","label":"Ano prosím"},{"id":"no","label":"Ne děkuji"}]'></div>`
    expect(calculateArticleMetrics(content, 40, 400).totalWords).toBe(7)
  })
})
