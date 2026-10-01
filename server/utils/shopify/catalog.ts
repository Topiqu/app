import { shopifyAccessToken } from './token'
import { shopifyGraphql, ShopifyApiError } from './api'
import { collectFeedProducts, hashFeedProducts, parsePrice, plainText, type RawVariant } from '../knowledge/feed'

type Page<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
type Variant = {
  id: string
  price: string
  inventoryQuantity: number | null
  inventoryPolicy: 'DENY' | 'CONTINUE'
  inventoryItem: { tracked: boolean }
  selectedOptions: { name: string; value: string }[]
}
type Collection = { id: string; title: string; description: string; handle: string }
export type CatalogProduct = {
  id: string
  title: string
  description: string
  vendor: string
  productType: string
  onlineStoreUrl: string | null
  variants: Page<Variant>
  collections: Page<Collection>
}

const PAGE_INFO = 'pageInfo { hasNextPage endCursor }'
const VARIANTS = `nodes { id price inventoryQuantity inventoryPolicy inventoryItem { tracked } selectedOptions { name value } } ${PAGE_INFO}`
const COLLECTIONS = `nodes { id title description handle } ${PAGE_INFO}`
const PRODUCT_QUERY = `query TopiquCatalog($after: String) {
  shop { currencyCode }
  products(first: 5, after: $after, sortKey: ID, query: "status:active AND published_status:published") {
    nodes { id title description vendor productType onlineStoreUrl
      variants(first: 50) { ${VARIANTS} }
      collections(first: 20) { ${COLLECTIONS} }
    } ${PAGE_INFO}
  }
}`

export const catalogVariants = (product: CatalogProduct, currency: string): RawVariant[] => {
  if (!product.onlineStoreUrl) return []
  return product.variants.nodes.map((variant) => ({
    id: variant.id,
    groupId: product.id,
    name: product.title,
    description: product.description,
    url: product.onlineStoreUrl!,
    price: variant.price,
    currency,
    availability:
      !variant.inventoryItem.tracked || (variant.inventoryQuantity ?? 0) > 0
        ? 'IN_STOCK'
        : variant.inventoryPolicy === 'CONTINUE'
          ? 'BACKORDER'
          : 'OUT_OF_STOCK',
    brand: product.vendor,
    category: product.productType ? [product.productType] : [],
    params: [
      ...variant.selectedOptions
        .filter((option) => option.value !== 'Default Title')
        .map((option): [string, string] => [option.name, option.value]),
      ...product.collections.nodes.map((collection): [string, string] => ['Collection', collection.title]),
      ...product.collections.nodes
        .filter((collection) => collection.description)
        .map((collection): [string, string] => [collection.title, collection.description]),
    ],
  }))
}

/** All nested pages are fetched before applying the snapshot; a partial API response never deletes products. */
export const fetchShopifyCatalog = async (connectionId: string, clientSiteId: string, limit: number) => {
  const connection = await prisma.shopifyConnection.findFirst({
    where: { id: connectionId, clientSiteId, status: 'CONNECTED' },
    select: { id: true, shop: true, grantedScopes: true, catalogRevision: true },
  })
  if (!connection || !connection.grantedScopes.includes('read_products'))
    throw new ShopifyApiError('REAUTH_REQUIRED', 'Reconnect Shopify to sync products')
  const token = await shopifyAccessToken(connection.id)
  const variants: RawVariant[] = []
  const catalog = new Map<string, CatalogProduct>()
  let after: string | null = null
  let count = 0
  do {
    const result: { shop: { currencyCode: string }; products: Page<CatalogProduct> } = await shopifyGraphql(
      connection.shop,
      token,
      PRODUCT_QUERY,
      { after },
      false,
      true,
    )
    for (const product of result.products.nodes) {
      for (const key of ['variants', 'collections'] as const) {
        while (product[key].pageInfo.hasNextPage) {
          const cursor = product[key].pageInfo.endCursor
          if (!cursor) throw new ShopifyApiError('RETRY', 'Shopify returned an incomplete catalog page')
          const next = await shopifyGraphql<{ product: Pick<CatalogProduct, typeof key> | null }>(
            connection.shop,
            token,
            `query TopiquCatalogDetails($id: ID!, $after: String) { product(id: $id) { ${key}(first: 50, after: $after) { ${key === 'variants' ? VARIANTS : COLLECTIONS} } } }`,
            { id: product.id, after: cursor },
            false,
            true,
          )
          if (!next.product || next.product[key].pageInfo.endCursor === cursor)
            throw new ShopifyApiError('RETRY', 'Shopify catalog changed during synchronization')
          // The two connections have different node types; branch to retain their contracts.
          if (key === 'variants')
            product.variants.nodes.push(...(next.product as Pick<CatalogProduct, 'variants'>).variants.nodes)
          else
            product.collections.nodes.push(...(next.product as Pick<CatalogProduct, 'collections'>).collections.nodes)
          product[key].pageInfo = next.product[key].pageInfo
        }
      }
      const entries = catalogVariants(product, result.shop.currencyCode)
      variants.push(...entries)
      catalog.set(product.id, product)
      if (entries.length) count += 1
    }
    // Fetching a large store can outlast a stale worker lease, so heartbeat before embedding starts too.
    await prisma.knowledgeSource.updateMany({
      where: { shopifyConnectionId: connection.id, clientSiteId, status: 'PROCESSING' },
      data: { updatedAt: new Date() },
    })
    if (!result.products.pageInfo.hasNextPage || count > limit) break
    const cursor = result.products.pageInfo.endCursor
    if (!cursor || cursor === after) throw new ShopifyApiError('RETRY', 'Shopify returned an incomplete catalog page')
    after = cursor
  } while (after !== null)
  const collected = collectFeedProducts(variants, limit)
  const collections = new Map<
    string,
    { id: string; title: string; description: string; products: number; available: number }
  >()
  for (const product of collected.products) {
    // A sold-out cheaper variant must not determine the price quoted for an orderable product.
    const availablePrices =
      catalog
        .get(product.externalId)
        ?.variants.nodes.filter(
          (variant) =>
            !variant.inventoryItem.tracked ||
            (variant.inventoryQuantity ?? 0) > 0 ||
            variant.inventoryPolicy === 'CONTINUE',
        )
        .map((variant) => parsePrice(variant.price))
        .filter((price): price is string => price !== null) ?? []
    if (availablePrices.length && product.currency)
      product.price = availablePrices.reduce((a, b) => (Number(b) < Number(a) ? b : a))
    for (const collection of catalog.get(product.externalId)?.collections.nodes ?? []) {
      const entry = collections.get(collection.id) ?? {
        id: collection.id,
        title: plainText(collection.title, 200),
        description: plainText(collection.description, 500),
        products: 0,
        available: 0,
      }
      entry.products += 1
      if (product.availability !== 'OUT_OF_STOCK') entry.available += 1
      collections.set(collection.id, entry)
    }
  }
  return {
    ...collected,
    hash: hashFeedProducts(collected.products),
    report: {
      ...collected.report,
      collections: [...collections.values()].sort(
        (a, b) => b.available - a.available || a.title.localeCompare(b.title),
      ),
    },
    revision: connection.catalogRevision,
  }
}

/** Coalesce duplicate and out-of-order events by fetching current state rather than applying webhook payloads. */
export const queueShopifyCatalog = async (shop: string) => {
  await prisma.shopifyConnection.updateMany({
    where: { shop, status: 'CONNECTED' },
    data: { catalogRevision: { increment: 1 } },
  })
  await prisma.knowledgeSource.updateMany({
    where: {
      kind: 'SHOPIFY',
      deletedAt: null,
      status: { not: 'PROCESSING' },
      shopifyConnection: { shop, status: 'CONNECTED' },
    },
    data: { status: 'PENDING', attempts: 0 },
  })
}

export const queueDirtyShopifyCatalogs = () => prisma.$executeRaw`
  UPDATE "KnowledgeSource" s SET "status" = 'PENDING', "attempts" = 0
  FROM "ShopifyConnection" c WHERE s."shopifyConnectionId" = c."id"
    AND s."kind" = 'SHOPIFY' AND s."deletedAt" IS NULL AND s."status" <> 'PROCESSING'
    AND c."status" = 'CONNECTED' AND c."catalogRevision" <> c."catalogSyncedRevision"
    AND (s."fetchedAt" IS NULL OR s."fetchedAt" < now() - interval '5 minutes')`
