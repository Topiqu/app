import { z } from 'zod'

import { shopifyGraphql } from '../../utils/shopify/api'
import { shopifyAccessToken } from '../../utils/shopify/token'
import { requireShopifyAccess } from '../../utils/shopify/access'

const Settings = z.object({
  blogId: z.string().regex(/^gid:\/\/shopify\/Blog\/\d+$/),
  author: z.string().trim().min(1).max(255),
})

export default defineEventHandler(async (event) => {
  const { db, site } = await requireShopifyAccess(event)
  const parsed = Settings.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Choose a blog and author' })
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: site.id },
    select: { id: true, shop: true },
  })
  if (!connection) throw createError({ statusCode: 404, message: 'Connect Shopify first' })
  const token = await shopifyAccessToken(connection.id)
  const result = await shopifyGraphql<{ blog: { id: string; title: string } | null }>(
    connection.shop,
    token,
    'query TopiquBlog($id: ID!) { blog(id: $id) { id title } }',
    { id: parsed.data.blogId },
  )
  if (!result.blog) throw createError({ statusCode: 400, message: 'The selected blog does not exist in this store' })
  await db.shopifyConnection.update({
    where: { id: connection.id },
    data: { blogId: result.blog.id, blogTitle: result.blog.title, author: parsed.data.author },
    select: { id: true },
  })
  return { success: true }
})
