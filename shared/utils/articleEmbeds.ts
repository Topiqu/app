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

type Attr = (name: string) => string | null

/** Bodies are author-editable, so a card renders only with https links; otherwise it stays HTML. */
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
