import { describe, expect, it } from 'vitest'

import { maskContentBlocks, rebuildContent } from '../../../server/utils/ai/translate'

const optionsAttr = (opts: Array<{ id: string; label: string }>) => JSON.stringify(opts).replace(/"/g, '&quot;')

const POLL = `<div data-type="poll" data-poll-id="poll-1" data-question="Líbí se ti to?" data-options="${optionsAttr([
  { id: 'opt-a', label: 'Ano' },
  { id: 'opt-b', label: 'Ne' },
])}"></div>`

const TWEET =
  '<blockquote class="twitter-tweet"><a href="https://x.com/foo/status/1"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'

const IMG = '<p style="text-align: center;"><img src="https://cdn/x.jpg" alt="popisek" /></p>'

const CONTENT = `<h1>Nadpis</h1><p>Odstavec.</p>${POLL}${TWEET}${IMG}`

describe('maskContentBlocks', () => {
  it('extracts polls with ids and replaces blocks with placeholders', () => {
    const { masked, polls, verbatim } = maskContentBlocks(CONTENT)

    expect(masked).toContain('[[POLLBLK_0]]')
    expect(masked).toContain('[[BLK_0]]')
    expect(masked).toContain('[[BLK_1]]')
    // No id-bearing or embed markup leaks into the masked (LLM-bound) string.
    expect(masked).not.toContain('poll-1')
    expect(masked).not.toContain('opt-a')
    expect(masked).not.toContain('twitter-tweet')
    expect(masked).not.toContain('cdn/x.jpg')

    expect(polls).toHaveLength(1)
    expect(polls[0]).toMatchObject({
      pollId: 'poll-1',
      question: 'Líbí se ti to?',
      options: [
        { id: 'opt-a', label: 'Ano' },
        { id: 'opt-b', label: 'Ne' },
      ],
    })
    expect(verbatim).toHaveLength(2)
  })

  it('round-trips back to equivalent structure when nothing is translated', () => {
    const { masked, polls, verbatim } = maskContentBlocks(CONTENT)
    const rebuilt = rebuildContent(masked, verbatim, polls)

    expect(rebuilt).toContain('data-poll-id="poll-1"')
    expect(rebuilt).toContain('opt-a')
    expect(rebuilt).toContain('opt-b')
    expect(rebuilt).toContain('twitter-tweet')
    expect(rebuilt).toContain('platform.twitter.com/widgets.js')
    expect(rebuilt).toContain('cdn/x.jpg')
  })
})

describe('rebuildContent', () => {
  it('preserves poll + option ids verbatim even when question and labels are translated', () => {
    const { masked, polls, verbatim } = maskContentBlocks(CONTENT)

    // Simulate the LLM having translated only the visible poll text.
    const translatedPolls = polls.map((p) => ({
      ...p,
      question: 'Do you like it?',
      options: p.options.map((o, i) => ({ id: o.id, label: i === 0 ? 'Yes' : 'No' })),
    }))

    const rebuilt = rebuildContent(masked, verbatim, translatedPolls)

    expect(rebuilt).toContain('data-poll-id="poll-1"')
    expect(rebuilt).toContain('Do you like it?')
    expect(rebuilt).toContain('Yes')
    expect(rebuilt).toContain('No')
    // Critical invariant: option ids that votes key off must be untouched.
    expect(rebuilt).toContain('opt-a')
    expect(rebuilt).toContain('opt-b')
  })

  it('handles content with no blocks', () => {
    const plain = '<h1>Title</h1><p>Body.</p>'
    const { masked, polls, verbatim } = maskContentBlocks(plain)
    expect(polls).toHaveLength(0)
    expect(verbatim).toHaveLength(0)
    expect(rebuildContent(masked, verbatim, polls)).toContain('<h1>Title</h1>')
  })
})
