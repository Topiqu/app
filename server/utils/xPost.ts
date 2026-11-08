import * as cheerio from 'cheerio'
import { parseXPostUrl, xPostDate, type XPostData } from '~~/shared/utils/articleEmbeds'

const OEMBED = 'https://publish.x.com/oembed'
const MAX_TEXT = 1000
const MEDIA_LINK = /^(?:https?:\/\/)?pic\.(?:x|twitter)\.com\//i
const HANDLE = /^\/([A-Za-z0-9_]{1,15})\/?$/

export class XPostError extends Error {
  constructor(readonly code: 'invalid' | 'notFound' | 'unavailable') {
    super(code)
  }
}

/** The post's text from oEmbed markup: line breaks kept, the photo link dropped and flagged. */
export const readXPostText = (html: string) => {
  const $ = cheerio.load(html, null, false)
  const paragraph = $('blockquote > p').first()
  let media = false
  paragraph.find('a').each((_, el) => {
    if (!MEDIA_LINK.test($(el).text().trim())) return
    media = true
    $(el).remove()
  })
  paragraph.find('br').replaceWith('\n')
  const text = paragraph
    .text()
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: text.slice(0, MAX_TEXT), media }
}

/**
 * One request to X's public oEmbed endpoint; the reader's browser never talks to X. The host is
 * fixed and only the canonical URL is passed on, so no input reaches the request but a post id.
 */
export const fetchXPost = async (value: string, language: string): Promise<XPostData> => {
  const parsed = parseXPostUrl(value)
  if (!parsed) throw new XPostError('invalid')
  const query = new URLSearchParams({ url: parsed.url, omit_script: '1', dnt: 'true', lang: language })
  const response = await fetch(`${OEMBED}?${query}`, {
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    throw new XPostError('unavailable')
  })
  if (response.status === 404 || response.status === 403) throw new XPostError('notFound')
  if (!response.ok) throw new XPostError('unavailable')
  const body = (await response.json().catch(() => null)) as {
    html?: unknown
    author_name?: unknown
    author_url?: unknown
  } | null
  if (typeof body?.html !== 'string') throw new XPostError('unavailable')
  const { text, media } = readXPostText(body.html)
  if (!text && !media) throw new XPostError('notFound')
  // `/i/status/<id>` links carry no handle; the author URL does.
  const handle =
    (typeof body.author_url === 'string' && URL.parse(body.author_url)?.pathname.match(HANDLE)?.[1]) || parsed.handle
  return {
    url: `https://x.com/${handle}/status/${parsed.id}`,
    author: (typeof body.author_name === 'string' && body.author_name.trim().slice(0, 100)) || handle,
    handle,
    text,
    date: xPostDate(parsed.id),
    media,
  }
}
