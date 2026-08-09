import { describe, expect, it } from 'vitest'

import { pickWikimediaImage, wikimediaImage } from '../../../server/utils/images/wikimedia'
import { openverseImage, pickOpenverseImage } from '../../../server/utils/images/openverse'

const commonsPage = (over: Record<string, any> = {}) => ({
  index: 1,
  title: 'File:Summit.jpg',
  imageinfo: [
    {
      url: 'https://upload.wikimedia.org/original.jpg',
      thumburl: 'https://upload.wikimedia.org/thumb-1200.jpg',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Summit.jpg',
      mime: 'image/jpeg',
      width: 1600,
      height: 900,
      extmetadata: {
        Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:X">Kremlin.ru</a>' },
        LicenseShortName: { value: 'CC BY 4.0' },
        LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0' },
        ImageDescription: { value: 'Two presidents <b>meeting</b>' },
      },
      ...over,
    },
  ],
})

describe('wikimediaImage', () => {
  it('prefers the width-capped render and flattens the HTML credit fields', () => {
    const image = wikimediaImage(commonsPage())!

    expect(image.url).toBe('https://upload.wikimedia.org/thumb-1200.jpg')
    expect(image.alt).toBe('Two presidents meeting')
    expect(image.credit).toMatchObject({
      author: 'Kremlin.ru',
      license: 'CC BY 4.0',
      source: 'Wikimedia Commons',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Summit.jpg',
    })
  })

  it('rejects the non-raster files Commons serves from the same namespace', () => {
    for (const mime of ['image/svg+xml', 'application/pdf', 'video/webm', 'image/tiff']) {
      expect(wikimediaImage(commonsPage({ mime }))).toBeNull()
    }
  })

  it('falls back to the file name when the file carries no description', () => {
    const page = commonsPage({ extmetadata: {} })

    expect(wikimediaImage(page)!.alt).toBe('Summit')
    expect(wikimediaImage(page)!.credit.author).toBeUndefined()
  })
})

describe('pickWikimediaImage', () => {
  it('takes the first landscape result, ignoring search order', () => {
    const portrait = { ...commonsPage(), index: 1 }
    portrait.imageinfo[0]!.width = 800
    portrait.imageinfo[0]!.height = 1200
    portrait.imageinfo[0]!.thumburl = 'https://upload.wikimedia.org/portrait.jpg'

    const landscape = { ...commonsPage(), index: 2 }

    expect(pickWikimediaImage([landscape, portrait])!.url).toBe('https://upload.wikimedia.org/thumb-1200.jpg')
  })

  it('still returns a portrait when that is all there is', () => {
    const portrait = commonsPage({ width: 800, height: 1200 })

    expect(pickWikimediaImage([portrait])).not.toBeNull()
  })

  it('returns null for an empty or unusable result set', () => {
    expect(pickWikimediaImage([])).toBeNull()
    expect(pickWikimediaImage([commonsPage({ mime: 'image/svg+xml' })])).toBeNull()
  })
})

describe('openverseImage', () => {
  it('composes a readable license name', () => {
    expect(openverseImage({ url: 'https://x/1.jpg', license: 'by-sa', license_version: '4.0' })!.credit.license).toBe(
      'CC BY-SA 4.0',
    )
    expect(openverseImage({ url: 'https://x/1.jpg', license: 'cc0', license_version: '1.0' })!.credit.license).toBe(
      'CC0 1.0',
    )
    expect(openverseImage({ url: 'https://x/1.jpg', license: 'pdm', license_version: 'N/A' })!.credit.license).toBe(
      'Public Domain Mark',
    )
  })

  it('is null without a usable URL', () => {
    expect(openverseImage({ title: 'no url' })).toBeNull()
  })

  it('prefers landscape results', () => {
    const results = [
      { url: 'https://x/portrait.jpg', width: 600, height: 900 },
      { url: 'https://x/landscape.jpg', width: 1600, height: 900 },
    ]

    expect(pickOpenverseImage(results)!.url).toBe('https://x/landscape.jpg')
    expect(pickOpenverseImage([])).toBeNull()
  })
})
