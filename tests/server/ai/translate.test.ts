import { describe, expect, it } from 'vitest'

import { maskContentBlocks, rebuildContent } from '../../../server/utils/ai/translate'

const optionsAttr = (opts: Array<{ id: string; label: string }>) => JSON.stringify(opts).replace(/"/g, '&quot;')

const POLL = `<div data-type="poll" data-poll-id="poll-1" data-question="Líbí se ti to?" data-options="${optionsAttr([
  { id: 'opt-a', label: 'Ano' },
  { id: 'opt-b', label: 'Ne' },
])}"></div>`

const TWEET =
  '<blockquote class="twitter-tweet"><a href="https://x.com/foo/status/1"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'

const IMG = '<p style="text-align: center;"><img src="https://cdn/x.jpg" alt="popisek" title="titulek" /></p>'

const CONTENT = `<h1>Nadpis</h1><p>Odstavec.</p>${POLL}${TWEET}${IMG}`

describe('maskContentBlocks', () => {
  it('extracts polls with ids and replaces blocks with placeholders', () => {
    const { masked, polls, verbatim, images } = maskContentBlocks(CONTENT)

    expect(masked).toContain('[[POLLBLK_0]]')
    expect(masked).toContain('[[BLK_0]]')
    expect(masked).toContain('[[IMGBLK_0]]')
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
    // Tweet stays verbatim; the image is carried as a structured block so its alt/title
    // become translatable while its URL stays server-side.
    expect(verbatim).toHaveLength(1)
    expect(images).toHaveLength(1)
    expect(images[0]).toMatchObject({ alt: 'popisek', title: 'titulek' })
    expect(images[0]!.html).toContain('cdn/x.jpg')
  })

  it('round-trips back to equivalent structure when nothing is translated', () => {
    const { masked, polls, verbatim, images } = maskContentBlocks(CONTENT)
    const rebuilt = rebuildContent(masked, verbatim, polls, images)

    expect(rebuilt).toContain('data-poll-id="poll-1"')
    expect(rebuilt).toContain('opt-a')
    expect(rebuilt).toContain('opt-b')
    expect(rebuilt).toContain('twitter-tweet')
    expect(rebuilt).toContain('platform.twitter.com/widgets.js')
    expect(rebuilt).toContain('cdn/x.jpg')
    expect(rebuilt).toContain('alt="popisek"')
    expect(rebuilt).toContain('title="titulek"')
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

  it('translates image alt/title while keeping the src verbatim', () => {
    const { masked, polls, verbatim, images } = maskContentBlocks(CONTENT)

    // Simulate the LLM having translated only the image's visible text.
    const translatedImages = images.map((img) => ({ ...img, alt: 'caption', title: 'tooltip' }))

    const rebuilt = rebuildContent(masked, verbatim, polls, translatedImages)

    expect(rebuilt).toContain('alt="caption"')
    expect(rebuilt).toContain('title="tooltip"')
    // Critical invariant: the image URL the model never saw must be untouched.
    expect(rebuilt).toContain('cdn/x.jpg')
    expect(rebuilt).not.toContain('alt="popisek"')
  })

  it('leaves a decorative (empty alt) image untranslated', () => {
    const deco = '<p><img src="https://cdn/deco.jpg" alt="" /></p>'
    const { images } = maskContentBlocks(deco)
    expect(images[0]).toMatchObject({ alt: '' })
    expect(images[0]!.title).toBeUndefined()
  })

  it('extracts and translates link title / aria-label attributes without touching href', () => {
    const html = '<p><a href="https://x.com/a?b=1" title="Odkaz na web" aria-label="Otevřít web">web</a></p>'
    const { masked, verbatim, polls, images, attrs } = maskContentBlocks(html)

    expect(attrs).toEqual(['Odkaz na web', 'Otevřít web'])
    expect(masked).toContain('[[ATTR_0]]')
    expect(masked).toContain('[[ATTR_1]]')
    // Raw human-readable attribute text must not leak into the LLM-bound string.
    expect(masked).not.toContain('Odkaz na web')

    const rebuilt = rebuildContent(masked, verbatim, polls, images, ['Link to site', 'Open site'])
    expect(rebuilt).toContain('title="Link to site"')
    expect(rebuilt).toContain('aria-label="Open site"')
    // href the model never saw stays byte-for-byte intact.
    expect(rebuilt).toContain('href="https://x.com/a?b=1"')
  })

  it('HTML-escapes translated attribute values so they cannot break out of the attribute', () => {
    const html = '<p><a href="/x" title="orig">x</a></p>'
    const { masked, verbatim, polls, images } = maskContentBlocks(html)
    const rebuilt = rebuildContent(masked, verbatim, polls, images, ['" onmouseover="alert(1)'])
    expect(rebuilt).not.toContain('onmouseover="alert(1)"')
    expect(rebuilt).toContain('&quot; onmouseover=&quot;alert(1)')
  })

  it('handles content with no blocks', () => {
    const plain = '<h1>Title</h1><p>Body.</p>'
    const { masked, polls, verbatim, images } = maskContentBlocks(plain)
    expect(polls).toHaveLength(0)
    expect(verbatim).toHaveLength(0)
    expect(images).toHaveLength(0)
    expect(rebuildContent(masked, verbatim, polls, images)).toContain('<h1>Title</h1>')
  })
})
