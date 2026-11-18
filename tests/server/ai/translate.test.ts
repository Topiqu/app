import { describe, expect, it, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/sanitize'), 'escapeHtml')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
}

await stubImports()

const { localPassagesRule, maskContentBlocks, rebuildContent } = await import('../../../server/utils/ai/translate')
const { ctaHtml, productCardHtml, xPostHtml } = await import('../../../shared/utils/articleEmbeds')

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

describe('embeds', () => {
  it('keeps X posts and product cards out of the translation, verbatim', () => {
    const post = xPostHtml({
      url: 'https://x.com/topiqu/status/1',
      author: 'Topiqu',
      handle: 'topiqu',
      text: 'Původní text',
      date: null,
      media: false,
    })
    const card = productCardHtml({ productId: 'p1', url: 'https://shop.test/ryc', name: 'Rýč' })
    const { masked, verbatim, polls, images } = maskContentBlocks(`<p>Úvod</p>${post}${card}`)

    expect(masked).not.toContain('Původní text')
    expect(masked).not.toContain('Rýč')
    expect(masked).not.toContain('data-')
    expect(rebuildContent(masked, verbatim, polls, images)).toBe(`<p>Úvod</p>${post}${card}`)
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

describe('localPassagesRule', () => {
  it('adds nothing for an article that suits the market', () => {
    expect(localPassagesRule([])).toBe('')
  })

  it('lists the passages and forbids substituting facts from another country', () => {
    const rule = localPassagesRule(['Nová zelená úsporám', 'ceny v Kč'])
    expect(rule).toContain('"Nová zelená úsporám"; "ceny v Kč"')
    expect(rule).toContain('Never replace them with laws, prices, subsidies or institutions of another country.')
  })
})

beforeEach(stubImports)

describe('quizzes and calls to action', () => {
  const quiz = `<div data-type="quiz" data-poll-id="quiz-1" data-question="Kolik?" data-options="${optionsAttr([
    { id: 'q-a', label: 'Jedna' },
    { id: 'q-b', label: 'Dvě', correct: true } as { id: string; label: string },
  ])}" data-explanation="Protože dvě."></div>`
  const cta = ctaHtml({ title: 'Poradíme', text: 'Ozvěte se.', label: 'Kontakt', url: '/kontakt', tone: 'info' })

  it('sends only their texts to the model and restores ids, answer and link', () => {
    const { masked, verbatim, polls, images, attrs, ctas } = maskContentBlocks(`<p>Úvod</p>${quiz}${cta}`)
    expect(masked).toBe('<p>Úvod</p>[[POLLBLK_0]][[CTABLK_0]]')
    expect(polls[0]).toMatchObject({ kind: 'quiz', explanation: 'Protože dvě.', question: 'Kolik?' })
    expect(ctas).toEqual([{ title: 'Poradíme', text: 'Ozvěte se.', label: 'Kontakt', url: '/kontakt', tone: 'info' }])

    const translatedPolls = [
      {
        ...polls[0]!,
        question: 'How many?',
        options: polls[0]!.options.map((o, i) => ({ ...o, label: ['One', 'Two'][i]! })),
        explanation: 'Because two.',
      },
    ]
    const translatedCtas = [{ ...ctas[0]!, title: 'We can help', text: 'Get in touch.', label: 'Contact' }]
    const rebuilt = rebuildContent(masked, verbatim, translatedPolls, images, attrs, translatedCtas)

    expect(rebuilt).toContain('data-type="quiz"')
    expect(rebuilt).toContain('data-poll-id="quiz-1"')
    expect(rebuilt).toContain(
      '&quot;id&quot;:&quot;q-b&quot;,&quot;label&quot;:&quot;Two&quot;,&quot;correct&quot;:true',
    )
    expect(rebuilt).toContain('data-explanation="Because two."')
    expect(rebuilt).toContain(
      ctaHtml({ title: 'We can help', text: 'Get in touch.', label: 'Contact', url: '/kontakt', tone: 'info' }),
    )
  })

  it('drops a CTA without a usable link instead of translating its fallback', () => {
    const broken = ctaHtml({ title: 'T', text: '', label: 'L', url: 'http://x.test', tone: 'accent' })
    expect(maskContentBlocks(`<p>a</p>${broken}`).masked).toBe('<p>a</p>')
  })
})
