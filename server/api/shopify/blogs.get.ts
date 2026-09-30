import type { ShopifyBlog } from '~~/shared/types/shopify'

import { shopifyGraphql } from '../../utils/shopify/api'
import { shopifyAccessToken } from '../../utils/shopify/token'
import { requireShopifyAccess } from '../../utils/shopify/access'

export default defineEventHandler(async (event) => {
  const { db, site } = await requireShopifyAccess(event)
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: site.id },
    select: { id: true, shop: true },
  })
  if (!connection) throw createError({ statusCode: 404, message: 'Connect Shopify first' })
  const token = await shopifyAccessToken(connection.id)
  const blogs: ShopifyBlog[] = []
  let after: string | null = null
  for (let page = 0; page < 20; page++) {
    const result: { blogs: { nodes: ShopifyBlog[]; pageInfo: { hasNextPage: boolean; endCursor: string } } } =
      await shopifyGraphql(
        connection.shop,
        token,
        'query TopiquBlogs($after: String) { blogs(first: 100, after: $after) { nodes { id title handle } pageInfo { hasNextPage endCursor } } }',
        { after },
      )
    blogs.push(...result.blogs.nodes)
    if (!result.blogs.pageInfo.hasNextPage) return blogs
    after = result.blogs.pageInfo.endCursor
  }
  throw createError({ statusCode: 502, message: 'Shopify returned too many blogs' })
})
