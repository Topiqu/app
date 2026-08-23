import { describe, expect, it } from 'vitest'

import type { ArticleImage } from '../../../server/utils/images/types'

import { buildImageHtml, renderCredit, type CaptionLabels } from '../../../server/utils/images/caption'

const LABELS: CaptionLabels = {
  illustration: 'Ilustrační obrázek',
  ai: 'Ilustrační obrázek (AI)',
  photoBy: 'foto: {author}',
}

const image = (over: Partial<ArticleImage> = {}): ArticleImage => ({
  url: 'https://cdn/x.jpg',
  kind: 'photo',
  ...over,
})

describe('renderCredit', () => {
  it('joins author, license and source with links', () => {
    const html = renderCredit(
      {
        author: 'Kremlin.ru',
        authorUrl: 'https://kremlin.ru',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
        source: 'Wikimedia Commons',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      },
      LABELS,
    )

    expect(html).toBe(
      'foto: <a href="https://kremlin.ru" target="_blank" rel="noopener">Kremlin.ru</a>, ' +
        '<a href="https://creativecommons.org/licenses/by/4.0" target="_blank" rel="noopener">CC BY 4.0</a> / ' +
        '<a href="https://commons.wikimedia.org/wiki/File:X.jpg" target="_blank" rel="noopener">Wikimedia Commons</a>',
    )
  })

  it('degrades to the bare source when nothing else is known', () => {
    expect(renderCredit({ source: 'Openverse' }, LABELS)).toBe('Openverse')
  })

  it('escapes credit text and keeps a $-bearing author intact', () => {
    // `$&` in a name would splice the whole match back in under a string replacement.
    const html = renderCredit({ author: 'A$& <b>B</b>', source: 'Openverse' }, LABELS)

    expect(html).toContain('A$&amp; &lt;b&gt;B&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })
})

describe('buildImageHtml', () => {
  it('keeps the <p><img> shape the editor and lightbox depend on', () => {
    const html = buildImageHtml(image(), 'Summit v Ženevě', LABELS)

    expect(html).toMatch(/^<p style="text-align: center;"><img src="https:\/\/cdn\/x\.jpg" alt="Summit v Ženevě" \/>/)
    expect(html).toContain('<br><small')
    expect(html).not.toContain('<figure')
  })

  // Only the AI label is wrapped: `data-ai-disclosure` is what `Parsed.vue` strips and
  // `[slug].vue` hides when a tenant turns disclosure off, so the span must hold the label and
  // its separator and nothing else — the caption itself has to survive the strip.
  it('labels a generated picture as AI and never prints a credit for it', () => {
    const html = buildImageHtml(image({ kind: 'ai' }), 'Hardware budoucnosti', LABELS)

    expect(html).toContain('<span data-ai-disclosure>Ilustrační obrázek (AI): </span>Hardware budoucnosti')
    expect(html).not.toContain('foto:')
  })

  it('labels a stock photo as illustrative while still crediting it', () => {
    const html = buildImageHtml(
      image({ kind: 'illustration', credit: { author: 'Jan Novák', source: 'Openverse' } }),
      'Herní sestava',
      LABELS,
    )

    expect(html).toContain('Ilustrační obrázek: Herní sestava — foto: Jan Novák / Openverse')
  })

  it('leaves a documentary caption unprefixed', () => {
    const html = buildImageHtml(image({ credit: { source: 'Wikimedia Commons' } }), 'Putin a Trump, 2026', LABELS)

    expect(html).toContain('>Putin a Trump, 2026 — ')
    expect(html).not.toContain('Ilustrační')
  })

  it('escapes a caption that carries markup', () => {
    const html = buildImageHtml(image(), '<img src=x onerror=alert(1)>', LABELS)

    expect(html).not.toContain('onerror=alert(1)>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('falls back to the provider description, then to a decorative empty alt', () => {
    expect(buildImageHtml(image({ alt: 'Two men shaking hands' }), '', LABELS)).toContain('alt="Two men shaking hands"')
    expect(buildImageHtml(image(), '', LABELS)).toContain('alt=""')
  })

  it('drops the caption line entirely when there is nothing to say', () => {
    expect(buildImageHtml(image(), '', LABELS)).not.toContain('<small')
  })
})
