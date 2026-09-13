import { afterEach, describe, expect, it, vi } from 'vitest'

import { createImageSelection } from '../../../server/utils/images/selection'
import { createSteamImageSearch, matchesSteamGame, steamScreenshots } from '../../../server/utils/images/steam'

afterEach(() => vi.unstubAllGlobals())
const screenshot = (id: string) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/ss_${id}.1920x1080.jpg`

describe('official game screenshot catalogue', () => {
  it('matches a game despite scene instructions but does not substitute sequels, DLC or bonus packs', () => {
    expect(matchesSteamGame('Cyberpunk 2077', 'Cyberpunk 2077 Night City official screenshot')).toBe(true)
    expect(matchesSteamGame('Cyberpunk 2077', 'Cyberpunk 2077 Update 2.0 gameplay screenshot')).toBe(true)
    expect(matchesSteamGame('Cyberpunk 2077', 'Cyberpunk 2 screenshot')).toBe(false)
    expect(matchesSteamGame('The Witcher 3', 'The Witcher 4 Ciri screenshot')).toBe(false)
    expect(matchesSteamGame('Cyberpunk 2077 REDmod', 'Cyberpunk 2077 screenshot')).toBe(false)
    expect(matchesSteamGame('Cyberpunk 2077: Phantom Liberty', 'Cyberpunk 2077 Night City')).toBe(false)
    expect(matchesSteamGame('Divinity', 'Divinity Original Sin 3 screenshot')).toBe(false)
  })

  it('uses only actual screenshot fields on the Steam CDN and keeps the original game in its credit', () => {
    const images = steamScreenshots({
      type: 'game',
      name: 'Cyberpunk 2077',
      publishers: ['CD PROJEKT RED'],
      screenshots: [
        { path_full: screenshot('abc') },
        { path_full: 'https://evil.test/ss_abc.jpg' },
        { path_full: 'https://shared.akamai.steamstatic.com/header.jpg' },
      ],
    })
    expect(images).toHaveLength(1)
    expect(images[0]?.credit.source).toContain('Cyberpunk 2077 — CD PROJEKT RED')
  })

  it('shares discovery across concurrent slots and selects three distinct assets without requiring a research citation', async () => {
    const fetch = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('storesearch')
          ? { items: [{ type: 'app', id: 1091500, name: 'Cyberpunk 2077' }] }
          : {
              '1091500': {
                success: true,
                data: {
                  type: 'game',
                  name: 'Cyberpunk 2077',
                  screenshots: ['abc', 'def', '123'].map((id) => ({ path_full: screenshot(id) })),
                },
              },
            },
    }))
    vi.stubGlobal('fetch', fetch)
    const search = createSteamImageSearch(),
      accept = createImageSelection()
    const images = await Promise.all([
      search('Cyberpunk 2077 Night City official screenshot', accept),
      search('Cyberpunk 2077 Night City official screenshot', accept),
      search('Cyberpunk 2077 Update 2.0 gameplay screenshot', accept),
    ])
    expect(images.every(Boolean)).toBe(true)
    expect(new Set(images.map((image) => image?.url)).size).toBe(3)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
