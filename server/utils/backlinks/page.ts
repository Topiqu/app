import { load } from 'cheerio'
import { toHostname } from '~~/shared/utils/domain'
import { isFollowed, isOwnedHost } from '~~/shared/utils/backlinks'

import { fetchPublicUrl, readLimitedBody } from '../images/publicFetch'

const MAX_PAGE_BYTES = 3_000_000
const CONTACT = /kontakt|contact|impressum|o-nas|about/i

export type PageLink = { href: string; rel: string[]; anchor: string | null }

/** `gone` is a missing page and counts against a link; `failed` (blocked, timeout, 5xx) does not. */
export type PageRead =
  | { status: 'ok'; title: string | null; text: string; links: PageLink[]; contactUrl: string | null }
  | { status: 'gone' }
  | { status: 'failed' }

/** Links to the tenant, followed first, plus a same-host contact page for the outreach. */
export const readPage = (html: string, pageUrl: string, owned: readonly string[]) => {
  const $ = load(html)
  const base = new URL(pageUrl)
  const links: PageLink[] = []
  let contactUrl: string | null = null
  $('a[href]').each((_, element) => {
    let url: URL
    try {
      url = new URL($(element).attr('href')!, base)
    } catch {
      return
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return
    const anchor =
      ($(element).text().replace(/\s+/g, ' ').trim() || $(element).find('img[alt]').attr('alt')?.trim() || '').slice(
        0,
        300,
      ) || null
    if (isOwnedHost(url.hostname, owned)) {
      const rel = ($(element).attr('rel') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
      links.push({ href: url.href, rel, anchor })
    } else if (
      !contactUrl &&
      toHostname(url.hostname) === toHostname(base.hostname) &&
      (CONTACT.test(url.pathname) || CONTACT.test(anchor ?? ''))
    )
      contactUrl = url.href
  })
  const title = $('title').first().text().replace(/\s+/g, ' ').trim().slice(0, 500) || null
  $('script, style, noscript, template').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  links.sort((a, b) => Number(isFollowed(b.rel)) - Number(isFollowed(a.rel)))
  return { title, text, links, contactUrl }
}

const charset = (contentType: string, head: Uint8Array) =>
  /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
  /<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder().decode(head.subarray(0, 2048)))?.[1] ??
  'utf-8'

const decode = (bytes: Uint8Array, contentType: string) => {
  try {
    return new TextDecoder(charset(contentType, bytes)).decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

/** A plain-http page is read over https: the public fetch pins https only, and most sites serve both. */
export const fetchPage = async (url: string, owned: readonly string[]): Promise<PageRead> => {
  try {
    const target = url.replace(/^http:\/\//i, 'https://')
    const response = await fetchPublicUrl(target, 10_000)
    if (response.status === 404 || response.status === 410) {
      await response.body?.cancel()
      return { status: 'gone' }
    }
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    if (!response.ok || !contentType.includes('html')) {
      await response.body?.cancel()
      return { status: 'failed' }
    }
    const html = decode(await readLimitedBody(response, MAX_PAGE_BYTES), contentType)
    return { status: 'ok', ...readPage(html, target, owned) }
  } catch {
    return { status: 'failed' }
  }
}

export const mapLimit = async <T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>) => {
  const results: R[] = []
  for (let index = 0; index < items.length; index += limit)
    results.push(...(await Promise.all(items.slice(index, index + limit).map(run))))
  return results
}
