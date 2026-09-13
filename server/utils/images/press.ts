import * as cheerio from 'cheerio'

import type { StockImage } from './types'

// Publisher-owned press assets, not images scraped from third-party reporting.
const publishers = [
  { host: 'press.cdprojektred.com', assetHost: 'press.cdn.cdpr.app', name: 'CD PROJEKT RED — Press Center' },
]
const terms = (text: string) =>
  text
    .toLowerCase()
    .replace(/\biv\b/g, '4')
    .match(/[a-z0-9]+/g) ?? []

export const parsePressImages = (html: string, source: string): StockImage[] => {
  const publisher = publishers.find((entry) => new URL(source).hostname === entry.host)
  if (!publisher) return []
  const $ = cheerio.load(html)
  const title = $('h1').first().text().trim()
  if (!title) return []
  const images: StockImage[] = []
  $('img').each((_, element) => {
    const raw = $(element).attr('data-crystal-link') || $(element).attr('src')
    if (!raw) return
    const url = new URL(raw, source)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== publisher.assetHost ||
      !/^\/news\/.*\.(png|jpe?g|webp)$/i.test(url.pathname)
    )
      return
    images.push({ url: url.href, alt: title, credit: { source: publisher.name, sourceUrl: url.href } })
  })
  return images
}

/** Load once per article; each slot chooses another asset from the relevant release. */
export const loadPressImages = async (sources: string[]) => {
  const pages = sources
    .filter((source) => {
      try {
        const url = new URL(source)
        return (
          url.protocol === 'https:' &&
          !url.port &&
          !url.username &&
          !url.password &&
          publishers.some((p) => p.host === url.hostname) &&
          /^\/en\/news\//.test(url.pathname)
        )
      } catch {
        return false
      }
    })
    .slice(0, 5)
  return (
    await Promise.all(
      pages.map(async (source) => {
        try {
          const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(8000) })
          return response.ok ? parsePressImages(await response.text(), source) : []
        } catch {
          return []
        }
      }),
    )
  ).flat()
}

export const pickPressImage = (images: StockImage[], query: string, accept: (image: StockImage) => boolean) => {
  const requested = terms(query).filter((word) => !['the', 'official', 'screenshot', 'image', 'photo'].includes(word))
  const ranked = images
    .map((image) => {
      const actual = new Set(terms(image.alt ?? ''))
      const score = requested.filter((word) => actual.has(word)).length
      const numbersMatch = requested.filter((word) => /^\d+$/.test(word)).every((word) => actual.has(word))
      return { image, score: numbersMatch && score >= 2 ? score : 0 }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
  return ranked.find(({ image }) => accept(image))?.image ?? null
}
