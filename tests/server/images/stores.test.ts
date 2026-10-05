import { afterEach, describe, expect, it, vi } from 'vitest'

import { storeMediaSource } from '../../../server/utils/images/stores'
import { createImageSelection } from '../../../server/utils/images/selection'
import { appStoreScreenshots, createAppStoreImageSearch } from '../../../server/utils/images/appStore'

afterEach(() => vi.unstubAllGlobals())

describe('store media registry', () => {
  it.each([
    ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/ss_abc123.1920x1080.jpg', 'Steam'],
    ['https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/aa/shot.png/392x696bb.png', 'App Store'],
    ['https://images.gog-statics.com/abc_product_card_v2_mobile_slider_639.jpg', 'GOG'],
    ['https://cdn1.epicgames.com/offer/abc/EGS_Title_1920x1080.jpg', 'Epic Games Store'],
    ['https://play-lh.googleusercontent.com/abc=w1052-h592', 'Google Play'],
  ])('recognises %s', (url, store) => {
    expect(storeMediaSource(url)).toBe(store)
  })

  it.each([
    // A Steam avatar or header is not a screenshot.
    'https://shared.akamai.steamstatic.com/header.jpg',
    // Album art shares Apple's CDN but is not app media.
    'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/aa/cover.jpg/600x600bb.jpg',
    // googleusercontent.com at large also serves private photos.
    'https://lh3.googleusercontent.com/abc=w1052',
    'https://cdn1.epicgames.com.evil.test/offer/abc.jpg',
    'http://cdn1.epicgames.com/offer/abc.jpg',
    'not a url',
  ])('rejects %s', (url) => {
    expect(storeMediaSource(url)).toBeNull()
  })
})

describe('App Store screenshots', () => {
  const shot = (id: string) =>
    `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/${id}/shot.png/392x696bb.png`
  const notion = {
    kind: 'software',
    trackName: 'Notion: Notes, Tasks, AI',
    sellerName: 'Notion Labs, Incorporated',
    trackViewUrl: 'https://apps.apple.com/us/app/notion/id1232780281',
    screenshotUrls: [shot('a'), 'https://evil.test/shot.png', shot('b')],
  }

  it('keeps only Apple CDN screenshots and credits the seller', () => {
    const images = appStoreScreenshots(notion)
    expect(images.map((image) => image.url)).toEqual([shot('a'), shot('b')])
    expect(images[0]?.credit).toEqual({
      source: 'Notion — Notion Labs, Incorporated (App Store)',
      sourceUrl: notion.trackViewUrl,
    })
  })

  it('matches the app by the name before its tagline and never a sibling app', async () => {
    const calendar = { ...notion, trackName: 'Notion Calendar', screenshotUrls: [shot('c')] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ results: [calendar, notion] }) })),
    )
    const search = createAppStoreImageSearch()
    expect((await search('Notion workspace screenshot', createImageSelection()))?.url).toBe(shot('a'))
  })
})
