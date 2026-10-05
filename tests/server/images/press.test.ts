import { describe, expect, it } from 'vitest'

import { createImageSelection } from '../../../server/utils/images/selection'
import {
  ccLicenseName,
  parsePressImages,
  pickPressImage,
  youtubeThumbnailImage,
} from '../../../server/utils/images/press'

describe('official first-party media', () => {
  it('discovers structured and press-download assets without a publisher allowlist', () => {
    const images = parsePressImages(
      `<head>
        <meta property="og:site_name" content="Larian Studios">
        <meta property="og:title" content="Divinity revealed">
        <meta property="og:image" content="https://cdn.larian.com/divinity/hero.jpg">
        <meta property="og:image:alt" content="Divinity official key art">
        <script type="application/ld+json">{"image":"https://assets.example-cdn.com/divinity/battle.jpg"}</script>
      </head><body>
        <img class="press-gallery" data-download="https://media.example-cdn.com/divinity/characters.jpg" alt="Divinity characters">
        <a class="press-download" href="https://downloads.example-cdn.com/divinity/world.png">Download world screenshot</a>
        <img src="https://cdn.larian.com/divinity/logo.png">
        <img src="https://untrusted.test/unrelated.jpg" alt="unrelated embed">
      </body>`,
      'https://larian.com/news/divinity-revealed',
    )

    expect(images).toHaveLength(4)
    expect(images.every((image) => image.credit.author === 'Larian Studios')).toBe(true)
    expect(images.every((image) => image.credit.authorUrl === 'https://larian.com/news/divinity-revealed')).toBe(true)
    expect(images.map((image) => image.url)).not.toContain('https://untrusted.test/unrelated.jpg')

    const accept = createImageSelection()
    expect(pickPressImage(images, 'Larian Divinity hero', accept)?.url).toContain('/hero.jpg')
    expect(pickPressImage(images, 'Divinity battle', accept)?.url).toContain('/battle.jpg')
  })

  it('credits a declared licence only to the images it covers', () => {
    const images = parsePressImages(
      `<head>
        <meta property="og:image" content="https://cdn.larian.com/divinity/hero.jpg">
        <script type="application/ld+json">{"@type":"ImageObject","contentUrl":"https://assets.example-cdn.com/divinity/map.jpg","license":"https://creativecommons.org/publicdomain/zero/1.0/"}</script>
      </head><body>
        <a rel="license" href="https://creativecommons.org/licenses/by/4.0/">Some rights reserved</a>
        <a class="press-download" href="https://agency.example.com/photo.jpg">Download photo</a>
      </body>`,
      'https://larian.com/news/divinity-revealed',
    )
    const licenseOf = (part: string) => images.find((image) => image.url.includes(part))?.credit.license

    expect(licenseOf('hero.jpg')).toBe('CC BY 4.0')
    expect(licenseOf('map.jpg')).toBe('CC0 1.0')
    // An asset the page only links to from another host does not inherit the page's licence.
    expect(licenseOf('agency.example.com')).toBeUndefined()
  })

  it.each([
    ['https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'],
    ['https://creativecommons.org/licenses/by-nc/2.0/deed.cs', 'CC BY-NC 2.0'],
    ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0 1.0'],
    ['https://creativecommons.org/publicdomain/mark/1.0/', 'Public Domain Mark'],
    ['https://example.com/terms', undefined],
  ])('names %s', (href, name) => {
    expect(ccLicenseName(href)).toBe(name)
  })

  it('derives a thumbnail only from a valid YouTube video URL', () => {
    expect(youtubeThumbnailImage('https://www.youtube.com/watch?v=abcdefghijk', 'Official trailer')).toMatchObject({
      url: 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg',
      alt: 'Official trailer',
    })
    expect(youtubeThumbnailImage('https://youtube.com/channel/not-a-video')).toBeNull()
  })
})
