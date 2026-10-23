export interface SerpItem {
  type: string
  rank_absolute?: number
  domain?: string
  title?: string
  url?: string
  description?: string
  items?: { title?: string }[] | null
}

export const serpSignals = (items: SerpItem[] | null | undefined) => {
  const list = items ?? []
  const questions = list
    .filter((item) => item.type === 'people_also_ask')
    .flatMap((item) => item.items ?? [])
    .map((question) => question.title?.trim())
    .filter((title): title is string => Boolean(title))
  const domains = list
    .filter((item) => item.type === 'organic' && item.domain)
    .sort((a, b) => (a.rank_absolute ?? 0) - (b.rank_absolute ?? 0))
    .map((item) => item.domain!)
  const urls = list
    .filter((item) => item.type === 'organic' && item.url)
    .sort((a, b) => (a.rank_absolute ?? 0) - (b.rank_absolute ?? 0))
    .slice(0, 10)
    .map((item) => normalizeUrl(item.url!))
  const organic: SearchResult[] = list
    .filter((item) => item.type === 'organic' && item.title && item.url && /^https?:\/\//.test(item.url) && item.domain)
    .sort((a, b) => (a.rank_absolute ?? 0) - (b.rank_absolute ?? 0))
    .slice(0, 5)
    .map((item) => ({
      title: item.title!,
      url: item.url!,
      domain: item.domain!,
      description: item.description?.slice(0, 300) ?? '',
    }))
  return {
    questions: [...new Set(questions)].slice(0, 5),
    aiOverview: list.some((item) => item.type === 'ai_overview'),
    domains: [...new Set(domains)].slice(0, 10),
    organic,
    urls: [...new Set(urls)],
  }
}

const normalizeUrl = (url: string) =>
  url
    .toLocaleLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
