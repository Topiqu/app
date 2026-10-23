type StoreApp = {
  kind?: string
  trackName?: string
  sellerName?: string
  trackViewUrl?: string
  screenshotUrls?: string[]
}

/** Listing names carry a tagline (`Notion: Notes, Tasks, AI`); only the part before it names the app. */
const appTitle = (name: string) => name.split(/\s*[:|–—]\s|\s-\s/)[0]!.trim()

export const appStoreScreenshots = (app: StoreApp): StockImage[] => {
  if (app.kind !== 'software' || !app.trackName) return []
  const title = appTitle(app.trackName)
  return (app.screenshotUrls ?? []).flatMap((url) =>
    storeMediaSource(url) === 'App Store'
      ? [
          {
            url,
            alt: title,
            credit: {
              source: `${title} — ${app.sellerName || 'App Store'} (App Store)`,
              sourceUrl: app.trackViewUrl || url,
            },
          },
        ]
      : [],
  )
}

/** iTunes Search is Apple's documented public catalogue API; one request per search term and article. */
export const createAppStoreImageSearch = () => {
  const searches = new Map<string, Promise<StoreApp[]>>()
  return async (query: string, accept: (image: StockImage) => boolean): Promise<StockImage | null> => {
    const search = storeSearchTerm(query)
    if (!search) return null
    try {
      if (!searches.has(search))
        searches.set(
          search,
          fetchJson(
            `https://itunes.apple.com/search?${new URLSearchParams({ term: search, entity: 'software', limit: '5', country: 'us' })}`,
            { headers: imageApiHeaders() },
          ).then((data) => data.results ?? []),
        )
      const apps = (await searches.get(search)!).filter(
        (app) => app.trackName && matchesStoreTitle(appTitle(app.trackName), query),
      )
      for (const app of apps.slice(0, 2)) {
        const image = appStoreScreenshots(app).find(accept)
        if (image) return image
      }
    } catch (error) {
      console.error('[images/appStore] search failed:', error)
    }
    return null
  }
}
