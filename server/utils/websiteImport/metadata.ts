import * as cheerio from 'cheerio'

export interface WebsiteMetadata {
  logoUrls: string[]
  faviconUrls: string[]
  colors: string[]
  socials: WebsiteValues['socials']
}
export const emptyWebsiteMetadata = (): WebsiteMetadata => ({ logoUrls: [], faviconUrls: [], colors: [], socials: [] })

const socialPlatform = (value: string): WebsiteValues['socials'][number]['platform'] | null => {
  const url = new URL(value)
  const host = url.hostname.replace(/^www\./, '')
  if (!url.pathname.replace(/\//g, '') || /(?:share|sharer|intent|login|signin)/i.test(url.pathname)) return null
  const platforms: Record<string, WebsiteValues['socials'][number]['platform']> = {
    'facebook.com': 'FACEBOOK',
    'instagram.com': 'INSTAGRAM',
    'linkedin.com': 'LINKEDIN',
    'youtube.com': 'YOUTUBE',
    'twitter.com': 'TWITTER',
    'x.com': 'TWITTER',
  }
  return platforms[host] ?? null
}

export const extractWebsiteMetadata = (html: string, pageUrl: string): WebsiteMetadata => {
  const $ = cheerio.load(html)
  const result = emptyWebsiteMetadata()
  const absolute = (value: unknown) => {
    if (typeof value !== 'string') return null
    try {
      const url = new URL(value, pageUrl)
      if (url.protocol !== 'https:' || url.username || url.password || url.port || url.href.length > 2048) return null
      url.hash = ''
      return url.href
    } catch {
      return null
    }
  }
  const logo = (value: unknown) => {
    const url = absolute(value)
    if (url && !result.logoUrls.includes(url) && result.logoUrls.length < 4) result.logoUrls.push(url)
  }
  const social = (value: unknown) => {
    const url = absolute(value)
    if (!url || url.length > 255) return
    const platform = socialPlatform(url)
    if (platform && !result.socials.some((entry) => entry.platform === platform)) result.socials.push({ platform, url })
  }
  for (const element of $('script[type="application/ld+json"]').slice(0, 8).toArray()) {
    const text = $(element).text()
    if (text.length > 32_000) continue
    try {
      const value: unknown = JSON.parse(text)
      const nodes: unknown[] = Array.isArray(value) ? value.slice(0, 30) : [value]
      for (let index = 0; index < nodes.length && index < 60; index++) {
        const node = nodes[index]
        if (!node || typeof node !== 'object') continue
        const record = node as Record<string, unknown>
        if (Array.isArray(record['@graph'])) nodes.push(...record['@graph'].slice(0, 30))
        const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']]
        if (!types.some((type) => ['Organization', 'LocalBusiness', 'Corporation', 'Store'].includes(String(type))))
          continue
        const image = record.logo
        logo(
          image && typeof image === 'object'
            ? ((image as Record<string, unknown>).url ?? (image as Record<string, unknown>).contentUrl)
            : image,
        )
        if (Array.isArray(record.sameAs)) record.sameAs.slice(0, 12).forEach(social)
      }
    } catch {
      /* Invalid third-party JSON-LD is not a failed import. */
    }
  }
  $('header img, img[itemprop="logo"]')
    .slice(0, 20)
    .each((_, element) => {
      const image = $(element)
      if (image.attr('itemprop') === 'logo' || /logo/i.test(`${image.attr('alt')} ${image.attr('src')}`))
        logo(image.attr('src'))
    })
  $('link[rel]')
    .slice(0, 100)
    .each((_, element) => {
      if (!/\b(?:icon|apple-touch-icon)\b/i.test($(element).attr('rel') ?? '')) return
      const url = absolute($(element).attr('href'))
      if (url && !result.faviconUrls.includes(url) && result.faviconUrls.length < 4) result.faviconUrls.push(url)
    })
  $('meta[name="theme-color"]')
    .slice(0, 4)
    .each((_, element) => {
      let color = $(element).attr('content')?.trim() ?? ''
      if (/^#[0-9a-f]{3}$/i.test(color)) color = `#${[...color.slice(1)].map((part) => part + part).join('')}`
      if (/^#[0-9a-f]{6}$/i.test(color) && !result.colors.includes(color.toUpperCase()))
        result.colors.push(color.toUpperCase())
    })
  $('header a[href], footer a[href]')
    .slice(0, 100)
    .each((_, element) => social($(element).attr('href')))
  return result
}
