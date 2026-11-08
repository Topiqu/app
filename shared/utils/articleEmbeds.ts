/** What a stored card carries; price, stock and image are read live at render. */
export type ProductCardRef = { productId: string; url: string; name: string }

/** Live facts are stamped at render; the editor preview has only the ref. `imageUrl` is our CDN copy. */
export type ProductCardData = ProductCardRef & {
  price: string | null
  currency: string | null
  availability: 'IN_STOCK' | 'PREORDER' | 'BACKORDER' | null
  imageUrl: string | null
}

const AVAILABILITY = new Set(['IN_STOCK', 'PREORDER', 'BACKORDER'])
const HTTPS = /^https:\/\//i

// Same escaping as the editor's DOM serializer, so a stored embed round-trips unchanged.
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeMarkup = (value: string) => escapeText(value).replace(/"/g, '&quot;')

/**
 * The inner link is the card's fallback: exports, feeds and a sold-out product render it as a plain
 * link, so no channel needs to know the card format.
 */
export const productCardHtml = ({ productId, url, name }: ProductCardRef) => {
  const [id, href, label] = [productId, url, name].map(escapeMarkup)
  return `<div data-type="product" data-product-id="${id}" data-url="${href}" data-name="${label}"><p><a href="${href}">${escapeText(name)}</a></p></div>`
}

export type XPostData = {
  url: string
  author: string
  handle: string
  text: string
  /** ISO time, read from the post id rather than stored. */
  date: string | null
  /** The post had a photo or video; only a link to it survives a static embed. */
  media: boolean
}

const STATUS_PATH = /^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,20})\/?$/
const X_HOSTS = new Set(['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com', 'mobile.x.com', 'mobile.twitter.com'])
// Twitter's snowflake epoch: the id's high bits are milliseconds since it.
const SNOWFLAKE_EPOCH = 1288834974657n

/** Canonical `https://x.com/<handle>/status/<id>`, or null for anything that is not one post. */
export const parseXPostUrl = (value: string) => {
  const url = URL.parse(value.trim())
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port || !X_HOSTS.has(url.hostname))
    return null
  const match = url.pathname.match(STATUS_PATH)
  if (!match) return null
  const [, handle, id] = match as unknown as [string, string, string]
  return { handle, id, url: `https://x.com/${handle}/status/${id}` }
}

const X_POST_LINK = /https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status(?:es)?\/\d{1,20}/gi

/** Post URLs that appear verbatim in a text, canonical; the writer may embed only these. */
export const findXPostUrls = (text: string | null | undefined, limit = 5) =>
  [...new Set([...(text ?? '').matchAll(X_POST_LINK)].flatMap(([match]) => parseXPostUrl(match)?.url ?? []))].slice(
    0,
    limit,
  )

export const xPostDate = (id: string) => {
  const ms = (BigInt(id) >> 22n) + SNOWFLAKE_EPOCH
  const date = new Date(Number(ms))
  return ms > SNOWFLAKE_EPOCH && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

/** Static on purpose: X's widget script would load a third-party tracker on every reader's page. */
export const xPostHtml = (post: XPostData) => {
  const paragraphs = post.text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((part) => `<p>${escapeText(part).replace(/\n/g, '<br>')}</p>`)
    .join('')
  return (
    `<blockquote data-type="x-post" data-url="${escapeMarkup(post.url)}" data-author="${escapeMarkup(post.author)}"` +
    `${post.media ? ' data-media="true"' : ''} data-text="${escapeMarkup(post.text)}">` +
    `${paragraphs}<p>— <a href="${escapeMarkup(post.url)}">${escapeText(`${post.author} (@${post.handle})`)}</a></p></blockquote>`
  )
}

type Attr = (name: string) => string | null

/** Bodies are author-editable, so a card or post renders only with https links; otherwise it stays HTML. */
export const readProductCard = (attr: Attr): ProductCardData | null => {
  const [productId, url, name] = [attr('data-product-id'), attr('data-url'), attr('data-name')]
  if (!productId || !url || !HTTPS.test(url) || !name) return null
  const availability = attr('data-availability')
  const image = attr('data-image')
  return {
    productId,
    url,
    name,
    price: attr('data-currency') ? attr('data-price') : null,
    currency: attr('data-price') ? attr('data-currency') : null,
    availability:
      availability && AVAILABILITY.has(availability) ? (availability as ProductCardData['availability']) : null,
    imageUrl: image && HTTPS.test(image) ? image : null,
  }
}

export const readXPost = (attr: Attr): XPostData | null => {
  const parsed = parseXPostUrl(attr('data-url') ?? '')
  const text = attr('data-text')?.trim() ?? ''
  const media = attr('data-media') === 'true'
  if (!parsed || (!text && !media)) return null
  return {
    url: parsed.url,
    author: attr('data-author') || parsed.handle,
    handle: parsed.handle,
    text,
    date: xPostDate(parsed.id),
    media,
  }
}
