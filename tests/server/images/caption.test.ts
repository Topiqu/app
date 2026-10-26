import { describe, expect, it, beforeEach } from 'vitest'

import type { ArticleImage } from '../../../server/utils/images/types'
import type { CaptionLabels } from '../../../server/utils/images/caption'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/sanitize'), 'escapeHtml')
}

await stubImports()
const { buildImageHtml, renderCredit } = await import('../../../server/utils/images/caption')

const LABELS: CaptionLabels = {
  illustration: 'Ilustrační obrázek',
  ai: 'Ilustrační obrázek (AI)',
  photoBy: 'Foto: {author}',
  illustrationBy: 'Ilustrační foto: {author}',
}

const image = (over: Partial<ArticleImage> = {}): ArticleImage => ({
  url: 'https://cdn/x.jpg',
  kind: 'photo',
  ...over,
})

describe('renderCredit', () => {
  it('links the name to the work and keeps the license beside it', () => {
    const html = renderCredit(
      {
        author: 'Kremlin.ru',
        authorUrl: 'https://kremlin.ru',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
        source: 'Wikimedia Commons',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      },
      LABELS.photoBy,
    )

    expect(html).toBe(
      'Foto: <a href="https://commons.wikimedia.org/wiki/File:X.jpg" target="_blank" rel="noopener">Kremlin.ru</a> ' +
        '(<a href="https://creativecommons.org/licenses/by/4.0" target="_blank" rel="noopener">CC BY 4.0</a>)',
    )
  })

  it('names the library when the author is unknown', () => {
    expect(renderCredit({ source: 'Openverse' }, LABELS.photoBy)).toBe('Foto: Openverse')
  })

  it('escapes credit text and keeps a $-bearing author intact', () => {
    // `$&` in a name would splice the whole match back in under a string replacement.
    const html = renderCredit({ author: 'A$& <b>B</b>', source: 'Openverse' }, LABELS.photoBy)

    expect(html).toContain('A$&amp; &lt;b&gt;B&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })
})

describe('buildImageHtml', () => {
  it('writes the figure the editor parses and the lightbox opens', () => {
    const html = buildImageHtml(image(), 'Summit v Ženevě', LABELS)

    expect(html).toBe(
      '<figure class="article-image"><img src="https://cdn/x.jpg" alt="Summit v Ženevě" data-article-lightbox="true" />' +
        '<figcaption>Summit v Ženevě</figcaption></figure>',
    )
  })

  // `data-ai-disclosure` is what `Parsed.vue` strips when a tenant turns disclosure off, leaving
  // an empty caption it drops. The description lives in alt only: under the image it just repeats it.
  it('labels a generated picture as AI and keeps its description in alt only', () => {
    const html = buildImageHtml(image({ kind: 'ai', width: 1280, height: 800 }), 'Hardware budoucnosti', LABELS)

    expect(html).toContain('alt="Hardware budoucnosti"')
    expect(html).toContain('<figcaption><span data-ai-disclosure>Ilustrační obrázek (AI)</span></figcaption>')
    expect(html.match(/Hardware budoucnosti/g)).toHaveLength(1)
    expect(html).toContain('width="1280" height="800"')
    expect(html).not.toContain('Foto:')
  })

  it('labels a stock photo as illustrative in its credit', () => {
    const html = buildImageHtml(
      image({ kind: 'illustration', credit: { author: 'Jan Novák', source: 'Openverse' } }),
      'Herní sestava',
      LABELS,
    )

    expect(html).toContain('Herní sestava — Ilustrační foto: Jan Novák')
    expect(html).not.toContain('Ilustrační obrázek')
  })

  it('prefixes an uncredited illustration itself', () => {
    expect(buildImageHtml(image({ kind: 'illustration' }), 'Herní sestava', LABELS)).toContain(
      '<figcaption>Ilustrační obrázek: Herní sestava</figcaption>',
    )
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
    expect(buildImageHtml(image(), '', LABELS)).not.toContain('<figcaption')
  })
})

beforeEach(stubImports)
