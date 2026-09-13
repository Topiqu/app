import type { StockImage } from './types'

import { fetchJson } from './http'

const terms = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .match(/[a-z0-9]+/g)
    ?.filter((word) => word !== 'the') ?? []

type StoreItem = { id: number; name: string; type: string }
type StoreGame = {
  type: string
  name: string
  publishers?: string[]
  screenshots?: Array<{ path_full: string }>
}

/** Match the actual game, never a previous numbered installment or similarly named DLC. */
export const matchesSteamGame = (name: string, query: string) => {
  const game = terms(name)
  const requested = terms(query)
  if (!game.length || !game.every((word, i) => word === requested[i])) return false
  if (requested.find((word) => /^\d+$/.test(word)) !== game.find((word) => /^\d+$/.test(word))) return false
  return !['original', 'sin', 'liberty', 'remake', 'remastered'].includes(requested[game.length] ?? '')
}

export const steamScreenshots = (game: StoreGame): StockImage[] => {
  if (game.type !== 'game' && game.type !== 'dlc') return []
  return (game.screenshots ?? []).flatMap(({ path_full }) => {
    try {
      const url = new URL(path_full)
      if (
        url.protocol !== 'https:' ||
        !url.hostname.endsWith('.steamstatic.com') ||
        url.port ||
        url.username ||
        url.password
      )
        return []
      if (!/\/ss_[a-f0-9]+(?:\.[\dx]+)?\.(jpg|png|webp)$/i.test(url.pathname)) return []
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
    } catch {
      return []
    }
  })
}

/** Per-article caches share catalogue requests across slots, but selection reserves distinct assets. */
export const createSteamImageSearch = () => {
  const searches = new Map<string, Promise<StoreItem[]>>()
  const games = new Map<number, Promise<StockImage[]>>()
  return async (query: string, accept: (image: StockImage) => boolean): Promise<StockImage | null> => {
    // Drop visual instructions for discovery only; returned game names must still match the full query.
    const words = terms(query)
    const number = words.findIndex((word) => /^\d+$/.test(word))
    const search =
      number >= 0
        ? words.slice(0, number + 1).join(' ')
        : query.split(/\b(?:official|screenshot|gameplay|photo|image|key art)\b/i)[0]!.trim()
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
        .filter((item) => item.type === 'app' && Number.isSafeInteger(item.id) && matchesSteamGame(item.name, query))
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
