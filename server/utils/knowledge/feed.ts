import type { KnowledgeProductAvailability } from '~~/generated/zenstack/models'

import { createHash } from 'node:crypto'
import { DomUtils, Parser, parseDocument } from 'htmlparser2'
import {
  KNOWLEDGE_CURRENCIES,
  KNOWLEDGE_LIMITS,
  type KnowledgeFeedReport,
  type KnowledgeFeedSkip,
} from '~~/shared/utils/knowledge'

import { KnowledgeExtractError } from './extract'
import { fetchPublicUrl } from '../images/publicFetch'

/** One merged product: the facts stored beside the chunk, and the text that is embedded. */
export type FeedProduct = {
  externalId: string
  name: string
  url: string
  price: string | null
  currency: string | null
  availability: KnowledgeProductAvailability
  text: string
  textHash: string
}

type FeedNode = { name: string; attribs: Record<string, string>; text: string; children: FeedNode[] }

/** What a format adapter reads; `normalizeVariant` owns every cleanup and check. */
export type RawVariant = {
  id?: string
  groupId?: string
  name?: string
  description?: string
  url?: string
  price?: string
  currency?: string
  availability: KnowledgeProductAvailability
  brand?: string
  category?: string[]
  params: [string, string][]
}

type Variant = Omit<FeedProduct, 'text' | 'textHash'> & {
  groupId: string
  description: string
  brand: string
  category: string
  params: [string, string][]
}

const ITEM_TAGS = new Set(['SHOPITEM', 'item', 'entry'])
const AVAILABILITY_RANK: KnowledgeProductAvailability[] = ['IN_STOCK', 'PREORDER', 'BACKORDER', 'OUT_OF_STOCK']
const CURRENCIES = new Set(KNOWLEDGE_CURRENCIES)
// Heureka appends its own attribution to product links; an article must not carry it.
const TRACKING_PARAM = /^(?:utm_|gclid$|fbclid$|msclkid$)/i

const child = (node: FeedNode, ...names: string[]) => {
  for (const name of names) {
    const text = node.children.find((entry) => entry.name === name)?.text.trim()
    if (text) return text
  }
}
const children = (node: FeedNode, name: string) => node.children.filter((entry) => entry.name === name)

/** Heureka DELIVERY_DATE: 0 is in stock, a number of days ships later, a date is a pre-order. */
const heurekaAvailability = (value?: string): KnowledgeProductAvailability =>
  !value || value === '0' ? 'IN_STOCK' : /^\d+$/.test(value) ? 'BACKORDER' : 'PREORDER'

const googleAvailability = (value?: string): KnowledgeProductAvailability => {
  const code = value?.toUpperCase().replace(/\s+/g, '_') as KnowledgeProductAvailability
  return AVAILABILITY_RANK.includes(code) ? code : 'IN_STOCK'
}

const heureka = (item: FeedNode, currency: string | null): RawVariant => ({
  id: child(item, 'ITEM_ID'),
  groupId: child(item, 'ITEMGROUP_ID'),
  name: child(item, 'PRODUCTNAME', 'PRODUCT'),
  description: child(item, 'DESCRIPTION'),
  url: child(item, 'URL'),
  price: child(item, 'PRICE_VAT'),
  currency: currency ?? undefined,
  availability: heurekaAvailability(child(item, 'DELIVERY_DATE')),
  brand: child(item, 'MANUFACTURER'),
  category: child(item, 'CATEGORYTEXT')?.split('|'),
  params: children(item, 'PARAM').map((param) => [child(param, 'PARAM_NAME') ?? '', child(param, 'VAL') ?? '']),
})

/** Google Merchant RSS or Atom; core RSS/Atom elements stand in for missing `g:` ones. */
const google = (item: FeedNode): RawVariant => {
  const price = child(item, 'g:price')?.match(/^(.*?)\s*([A-Za-z]{3})$/)
  return {
    id: child(item, 'g:id'),
    groupId: child(item, 'g:item_group_id'),
    name: child(item, 'g:title', 'title'),
    description: child(item, 'g:description', 'description', 'summary'),
    url: child(item, 'g:link', 'link') ?? children(item, 'link')[0]?.attribs.href,
    price: price?.[1],
    currency: price?.[2]?.toUpperCase(),
    availability: googleAvailability(child(item, 'g:availability')),
    brand: child(item, 'g:brand'),
    category: child(item, 'g:product_type')?.split('>'),
    params: children(item, 'g:product_detail').map((detail) => [
      child(detail, 'g:attribute_name') ?? '',
      child(detail, 'g:attribute_value') ?? '',
    ]),
  }
}

const BLOCK_END = /<\/(?:p|div|li|h[1-6]|tr)>|<br\s*\/?>/gi

/** Feed text is often HTML, escaped or in CDATA; entities outside XML's five survive the XML pass. */
export const plainText = (value: string | undefined, max: number) =>
  DomUtils.textContent(parseDocument((value ?? '').replace(BLOCK_END, '$& ')))
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

/** Links go into published articles and are never fetched by us: https, no credentials, no tracking. */
export const productUrl = (value: string | undefined) => {
  const url = value ? URL.parse(value.trim()) : null
  if (!url || url.protocol !== 'https:' || url.username || url.password) return null
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key)
  const href = url.toString()
  return href.length <= 2048 ? href : null
}

/** Dot or comma decimals, spaces as thousands. A number with both separators is ambiguous and dropped. */
export const parsePrice = (value: string | undefined) => {
  // `\s` covers the no-break space too.
  const match = value?.replace(/\s/g, '').match(/^(\d{1,10})(?:[.,](\d{1,2}))?$/)
  return match ? `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}` : null
}

export const normalizeVariant = (raw: RawVariant): Variant | KnowledgeFeedSkip => {
  const externalId = raw.id?.trim().slice(0, 128)
  if (!externalId) return 'id'
  const name = plainText(raw.name, 200)
  if (!name) return 'name'
  const url = productUrl(raw.url)
  if (!url) return 'url'
  const currency = raw.currency && CURRENCIES.has(raw.currency) ? raw.currency : null
  const price = currency ? parsePrice(raw.price) : null
  return {
    externalId,
    groupId: raw.groupId?.trim().slice(0, 128) || externalId,
    name,
    url,
    price,
    currency: price ? currency : null,
    availability: raw.availability,
    description: plainText(raw.description, 1500),
    brand: plainText(raw.brand, 100),
    category: (raw.category ?? [])
      .map((part) => plainText(part, 80))
      .filter(Boolean)
      .join(' › '),
    params: raw.params
      .map(([key, value]): [string, string] => [plainText(key, 60), plainText(value, 100)])
      .filter(([key, value]) => key && value),
  }
}

const productText = (variant: Variant, params: Map<string, Set<string>>) =>
  [
    variant.name,
    variant.brand && `Brand: ${variant.brand}`,
    variant.category && `Category: ${variant.category}`,
    ...[...params].slice(0, 20).map(([key, values]) => `${key}: ${[...values].join(', ').slice(0, 200)}`),
    variant.description,
  ]
    .filter(Boolean)
    .join('\n')

/**
 * Variants of one product share an `item_group_id`: they become one product so eight sizes of a
 * shirt do not fill the shortlist. It takes the lowest price, the best availability and the link
 * of the first variant that can be ordered.
 */
export const mergeVariants = (variants: readonly Variant[]): FeedProduct[] => {
  const groups = new Map<string, Variant[]>()
  for (const variant of variants) {
    const group = groups.get(variant.groupId)
    if (group) group.push(variant)
    else groups.set(variant.groupId, [variant])
  }
  return [...groups].map(([groupId, group]) => {
    const first = group[0]!
    const rank = (variant: Variant) => AVAILABILITY_RANK.indexOf(variant.availability)
    const best = group.reduce((a, b) => (rank(b) < rank(a) ? b : a))
    const priced = group.filter((variant) => variant.price && variant.currency === first.currency)
    const price = priced.length ? priced.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a)).price : null
    const params = new Map<string, Set<string>>()
    for (const [key, value] of group.flatMap((variant) => variant.params))
      params.set(key, (params.get(key) ?? new Set()).add(value))
    const text = productText(first, params)
    return {
      externalId: groupId,
      name: first.name,
      url: best.url,
      price,
      currency: price ? first.currency : null,
      availability: best.availability,
      text,
      textHash: createHash('sha256').update(text).digest('hex'),
    }
  })
}

/**
 * A streaming XML reader that hands over one item subtree at a time. htmlparser2 never reads a
 * DTD, so entity declarations are not expanded (no XXE, no "billion laughs").
 */
const itemParser = (onItem: (item: FeedNode) => void) => {
  const stack: FeedNode[] = []
  return new Parser(
    {
      onopentag(name, attribs) {
        if (!stack.length && !ITEM_TAGS.has(name)) return
        const node: FeedNode = { name, attribs, text: '', children: [] }
        stack.at(-1)?.children.push(node)
        stack.push(node)
      },
      ontext(text) {
        const node = stack.at(-1)
        if (node) node.text += text
      },
      onclosetag() {
        const node = stack.pop()
        if (node && !stack.length) onItem(node)
      },
    },
    { xmlMode: true },
  )
}

const feedReader = (currency: string | null) => {
  const raws: RawVariant[] = []
  const parser = itemParser((item) => raws.push(item.name === 'SHOPITEM' ? heureka(item, currency) : google(item)))
  return { raws, parser }
}

export const parseKnowledgeFeed = (xml: string, currency: string | null) => {
  const { raws, parser } = feedReader(currency)
  parser.end(xml)
  return raws
}

export const hashFeedProducts = (products: readonly FeedProduct[]) =>
  createHash('sha256')
    .update(JSON.stringify(products.map(({ text: _text, ...facts }) => Object.values(facts))))
    .digest('hex')

/** Normalises, merges and caps a feed; `hash` lets an unchanged feed skip the database entirely. */
export const collectFeedProducts = (raws: readonly RawVariant[], limit: number) => {
  const skipped: KnowledgeFeedReport['skipped'] = {}
  const variants: Variant[] = []
  for (const raw of raws) {
    const variant = normalizeVariant(raw)
    if (typeof variant === 'string') skipped[variant] = (skipped[variant] ?? 0) + 1
    else variants.push(variant)
  }
  const merged = mergeVariants(variants)
  const products = merged.slice(0, limit)
  const report: KnowledgeFeedReport = {
    items: raws.length,
    products: products.length,
    skipped,
    unpriced: products.filter((product) => !product.price).length,
    truncated: merged.length - products.length,
  }
  const hash = hashFeedProducts(products)
  return { products, report, hash }
}

/** Streams the feed through the parser, so a 50 MB file is never held as one string. */
export const fetchKnowledgeFeed = async (
  url: string,
  { currency, limit }: { currency: string | null; limit: number },
) => {
  const response = await fetchPublicUrl(url, 60_000).catch(() => {
    throw new KnowledgeExtractError('unreachable')
  })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new KnowledgeExtractError('unreachable')
  }
  const { raws, parser } = feedReader(currency)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  for (;;) {
    const { done, value } = await reader.read().catch(() => {
      throw new KnowledgeExtractError('unreachable')
    })
    if (done) break
    size += value.byteLength
    if (size > KNOWLEDGE_LIMITS.maxFeedBytes) {
      await reader.cancel()
      throw new KnowledgeExtractError('tooLarge')
    }
    parser.write(decoder.decode(value, { stream: true }))
  }
  parser.end(decoder.decode())
  const collected = collectFeedProducts(raws, limit)
  // A broken export must not wipe the catalog the articles rely on.
  if (!collected.report.items) throw new KnowledgeExtractError('notFeed')
  if (!collected.report.products && !collected.report.truncated) throw new KnowledgeExtractError('empty')
  return collected
}
