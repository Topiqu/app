import type { StockImage } from './types'

import { fetchJson } from './http'
import { matchesStoreTitle, storeMediaSource, storeSearchTerm } from './stores'

type StoreItem = { id: number; name: string; type: string }
type StoreGame = {
  type: string
  name: string
  publishers?: string[]
  screenshots?: Array<{ path_full: string }>
}

export const steamScreenshots = (game: StoreGame): StockImage[] => {
  if (game.type !== 'game' && game.type !== 'dlc') return []
  return (game.screenshots ?? []).flatMap(({ path_full }) => {
    if (storeMediaSource(path_full) !== 'Steam') return []
    const url = new URL(path_full)
    return [
      {
        url: url.href,
        alt: game.name,
        credit: {
          source: `${game.name} — ${(game.publishers ?? []).join(', ') || 'Steam'} (Steam)`,
          sourceUrl: url.href,
        },
      },
    ]
  })
}

/** Per-article caches share catalogue requests across slots, but selection reserves distinct assets. */
export const createSteamImageSearch = () => {
  const searches = new Map<string, Promise<StoreItem[]>>()
  const games = new Map<number, Promise<StockImage[]>>()
  return async (query: string, accept: (image: StockImage) => boolean): Promise<StockImage | null> => {
    const search = storeSearchTerm(query)
    if (!search) return null
    try {
      if (!searches.has(search))
        searches.set(
          search,
          fetchJson(
            `https://store.steampowered.com/api/storesearch/?${new URLSearchParams({ term: search, l: 'english', cc: 'us' })}`,
          ).then((data) => data.items ?? []),
        )
      const candidates = (await searches.get(search)!)
        .filter((item) => item.type === 'app' && Number.isSafeInteger(item.id) && matchesStoreTitle(item.name, query))
        .sort((a, b) => b.name.length - a.name.length)
      for (const item of candidates.slice(0, 2)) {
        if (!games.has(item.id))
          games.set(
            item.id,
            fetchJson(`https://store.steampowered.com/api/appdetails?appids=${item.id}&l=english`).then((data) => {
              const result = data[item.id]
              return result?.success && result.data?.name === item.name ? steamScreenshots(result.data) : []
            }),
          )
        const image = (await games.get(item.id)!).find(accept)
        if (image) return image
      }
    } catch (error) {
      console.error('[images/steam] search failed:', error)
    }
    return null
  }
}
