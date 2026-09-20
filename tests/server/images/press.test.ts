import { describe, expect, it } from 'vitest'

import { createImageSelection } from '../../../server/utils/images/selection'
import { parsePressImages, pickPressImage, youtubeThumbnailImage } from '../../../server/utils/images/press'

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

  it('derives a thumbnail only from a valid YouTube video URL', () => {
    expect(youtubeThumbnailImage('https://www.youtube.com/watch?v=abcdefghijk', 'Official trailer')).toMatchObject({
      url: 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg',
      alt: 'Official trailer',
    })
    expect(youtubeThumbnailImage('https://youtube.com/channel/not-a-video')).toBeNull()
  })
})
