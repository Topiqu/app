import type { FactCheckSource } from '~~/shared/types/articleFactCheck'

import * as cheerio from 'cheerio'
import { FACT_CHECK_LIMITS, normalizeFactCheckUrl } from '~~/shared/utils/articleFactCheck'

import { fetchPublicUrl, readLimitedBody } from './images/publicFetch'

export interface ReadableFactCheckSource extends FactCheckSource {
  content?: string
}

const metadataContent = ($: cheerio.CheerioAPI, selectors: string[]) => {
  for (const selector of selectors) {
    const element = $(selector).first()
    const value = element.attr('content')?.trim() || element.attr('datetime')?.trim() || element.text().trim()
    if (value) return value
  }
}

export const extractReadableSource = (html: string) => {
  const $ = cheerio.load(html)
  const title = metadataContent($, ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'title'])
  const publishedAt = metadataContent($, [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="datePublished"]',
    'time[datetime]',
  ])
  $('script, style, noscript, nav, footer, header, aside, form, svg').remove()
  const root = $('article').first().length
    ? $('article').first()
    : $('main').first().length
      ? $('main').first()
      : $('body')
  const content = root
    .find('h1, h2, h3, h4, p, li, blockquote, td, th')
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, ' ').trim())
    .filter((text, index, all) => text.length >= 20 && all.indexOf(text) === index)
    .join('\n')
    .slice(0, FACT_CHECK_LIMITS.maxSourceCharacters)
  return { title, publishedAt, content }
}

const sourceFailure = (index: number, url: string, detail: FactCheckSource['detail']): ReadableFactCheckSource => ({
  index,
  url,
  status:
    detail === 'invalid-url' || detail === 'private-host'
      ? 'invalid'
      : detail === 'not-readable'
        ? 'unsupported-content'
        : 'unreachable',
  detail,
})

const fetchOne = async (url: string, index: number): Promise<ReadableFactCheckSource> => {
  let normalized: string
  try {
    normalized = normalizeFactCheckUrl(url)
    if (!normalized.startsWith('https://')) return sourceFailure(index, url, 'invalid-url')
  } catch {
    return sourceFailure(index, url, 'invalid-url')
  }
  try {
    const response = await fetchPublicUrl(normalized, 10_000)
    if (!response.ok) {
      await response.body?.cancel()
      return sourceFailure(index, url, 'http-error')
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      await response.body?.cancel()
      return sourceFailure(index, url, 'not-readable')
    }
    const bytes = await readLimitedBody(response, FACT_CHECK_LIMITS.maxSourceBytes)
    const decoded = new TextDecoder().decode(bytes)
    const extracted = contentType.includes('text/html')
      ? extractReadableSource(decoded)
      : { title: undefined, publishedAt: undefined, content: decoded.replace(/\s+/g, ' ').trim() }
    if (extracted.content.length < 80) return sourceFailure(index, url, 'not-readable')
    return { index, url, status: 'ready', ...extracted }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/public|https|domain|host/i.test(message)) return sourceFailure(index, url, 'private-host')
    if (/large/i.test(message)) return sourceFailure(index, url, 'too-large')
    if (/timeout|abort/i.test(message)) return sourceFailure(index, url, 'timeout')
    return sourceFailure(index, url, 'http-error')
  }
}

export const inspectFactCheckSources = async (sources: string[]) => {
  const seen = new Map<string, number>()
  const unique: { url: string; index: number }[] = []
  const results: ReadableFactCheckSource[] = []

  sources.forEach((raw, index) => {
    const url = raw.trim()
    try {
      const normalized = normalizeFactCheckUrl(url)
      const duplicateOf = seen.get(normalized)
      if (duplicateOf !== undefined) results.push({ index, url, status: 'duplicate', duplicateOf })
      else {
        seen.set(normalized, index)
        unique.push({ url, index })
      }
    } catch {
      results.push(sourceFailure(index, url, 'invalid-url'))
    }
  })
  results.push(...(await Promise.all(unique.map(({ url, index }) => fetchOne(url, index)))))
  const readableCount = results.filter((source) => source.content).length
  const perSourceLimit = readableCount
    ? Math.min(
        FACT_CHECK_LIMITS.maxSourceCharacters,
        Math.floor(FACT_CHECK_LIMITS.maxTotalSourceCharacters / readableCount),
      )
    : 0
  return results
    .sort((a, b) => a.index - b.index)
    .map((source) => (source.content ? { ...source, content: source.content.slice(0, perSourceLimit) } : source))
}
