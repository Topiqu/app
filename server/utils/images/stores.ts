type StoreMedia = { name: string; host: RegExp; path?: RegExp }

/**
 * Stores whose product media the publisher uploads to promote the title, so an image served from their
 * CDN counts as publisher material however it was found. Hosts are exact on purpose: googleusercontent.com
 * at large also serves private user photos, and mzstatic.com music and book art is not app media.
 */
export const STORE_MEDIA: readonly StoreMedia[] = [
  { name: 'Steam', host: /\.steamstatic\.com$/, path: /\/ss_[a-f0-9]+(?:\.[\dx]+)?\.(?:jpg|png|webp)$/i },
  { name: 'App Store', host: /^is\d+(?:-ssl)?\.mzstatic\.com$/, path: /^\/image\/thumb\/Purple/ },
  { name: 'GOG', host: /^images(?:-\d+)?\.gog-statics\.com$/ },
  { name: 'Epic Games Store', host: /^cdn\d*\.epicgames\.com$/ },
  { name: 'Google Play', host: /^play-lh\.googleusercontent\.com$/ },
]

export const storeMediaSource = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password) return null
    const store = STORE_MEDIA.find(
      ({ host, path }) => host.test(parsed.hostname) && (!path || path.test(parsed.pathname)),
    )
    return store?.name ?? null
  } catch {
    return null
  }
}

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

/** Match the actual title, never a previous numbered installment or similarly named add-on. */
export const matchesStoreTitle = (name: string, query: string) => {
  const title = terms(name)
  const requested = terms(query)
  if (!title.length || !title.every((word, i) => word === requested[i])) return false
  if (requested.find((word) => /^\d+$/.test(word)) !== title.find((word) => /^\d+$/.test(word))) return false
  return !['original', 'sin', 'liberty', 'remake', 'remastered'].includes(requested[title.length] ?? '')
}

/** Drops visual instructions for discovery only; returned titles must still match the full query. */
export const storeSearchTerm = (query: string) => {
  const words = terms(query)
  const number = words.findIndex((word) => /^\d+$/.test(word))
  return number >= 0
    ? words.slice(0, number + 1).join(' ')
    : query.split(/\b(?:official|screenshot|gameplay|photo|image|key art)\b/i)[0]!.trim()
}
