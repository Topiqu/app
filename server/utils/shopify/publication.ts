import { randomUUID } from 'node:crypto'

import { shopifyEligible } from './config'
import { shopifyAccessToken } from './token'
import { ShopifyApiError, shopifyGraphql } from './api'
import { shopifyHandle, type ShopifyArticlePayload } from './content'

export const shopifyPublicationSelect = {
  id: true,
  status: true,
  shopifyArticleId: true,
  url: true,
  isPublished: true,
  lastSyncedAt: true,
  lastError: true,
} as const

interface RemoteArticle {
  id: string
  handle: string
  isPublished: boolean
  blog: { id: string; handle: string }
  marker: { value: string } | null
}

// A replaced connection drops its publication rows and a renamed slug changes the handle,
// so recovery searches every handle the article has had.
const articleHandles = async (articleId: string, handle: string) => {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { slug: true, slugRedirects: { select: { slug: true }, orderBy: { createdAt: 'desc' }, take: 8 } },
  })
  const slugs = article ? [article.slug, ...article.slugRedirects.map(({ slug }) => slug)] : []
  return [...new Set([handle, ...slugs.map((slug) => shopifyHandle(slug, articleId))])]
}

const ARTICLE_FIELDS =
  'id handle isPublished blog { id handle } marker: metafield(namespace: "topiqu", key: "article_id") { value }'

export const publishShopifyArticle = async (id: string) => {
  const lease = randomUUID()
  const claimed = await prisma.shopifyPublication.updateMany({
    where: {
      id,
      status: 'QUEUED',
      nextAttemptAt: { lte: new Date() },
      clientSite: { publishToShopify: true },
    },
    data: { status: 'PUBLISHING', lease, leaseUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 } },
  })
  if (!claimed.count) return
  const publication = await prisma.shopifyPublication.findUnique({
    where: { id },
    select: {
      connectionId: true,
      articleId: true,
      clientSiteId: true,
      shopifyArticleId: true,
      blogId: true,
      handle: true,
      payload: true,
      attempts: true,
      createStartedAt: true,
      connection: {
        select: {
          shop: true,
          status: true,
          storefrontUrl: true,
          clientSite: { select: { plan: true, deletedAt: true, publishToShopify: true } },
        },
      },
    },
  })
  if (!publication) return
  let creating = false
  const finish = (data: Parameters<typeof prisma.shopifyPublication.updateMany>[0]['data']) =>
    prisma.shopifyPublication.updateMany({
      where: { id, status: 'PUBLISHING', lease },
      data: { ...data, lease: null, leaseUntil: null },
    })
  try {
    if (publication.connection.clientSite.publishToShopify === false) {
      await finish({ status: 'QUEUED', attempts: { decrement: 1 } })
      return
    }
    if (
      publication.connection.status !== 'CONNECTED' ||
      publication.connection.clientSite.deletedAt ||
      !shopifyEligible(publication.connection.clientSite.plan)
    )
      throw new ShopifyApiError('REJECTED', 'Shopify connection is unavailable')
    const token = await shopifyAccessToken(publication.connectionId)
    const payload = publication.payload as unknown as ShopifyArticlePayload
    const call = <T>(query: string, variables: Record<string, unknown>, mutation = false) =>
      shopifyGraphql<T>(publication.connection.shop, token, query, variables, mutation)
    let remoteId = publication.shopifyArticleId
    // A recovered article keeps its blog and handle, so its storefront URL does not change.
    let recovered: Pick<RemoteArticle, 'handle' | 'blog'> | null = null
    if (!remoteId) {
      const handles = await articleHandles(publication.articleId, publication.handle)
      const found = await call<{ articles: { nodes: RemoteArticle[] } }>(
        `query TopiquFindArticle($query: String!) { articles(first: 25, query: $query) { nodes { ${ARTICLE_FIELDS} } } }`,
        { query: handles.map((handle) => `handle:${handle}`).join(' OR ') },
      )
      const ours = found.articles.nodes.find((article) => article.marker?.value === publication.articleId)
      if (ours) {
        remoteId = ours.id
        recovered = ours
      } else if (
        found.articles.nodes.some(
          (article) => article.blog.id === publication.blogId && article.handle === publication.handle,
        )
      )
        throw new ShopifyApiError('REJECTED', 'An unrelated Shopify article already uses this handle')
      else if (publication.createStartedAt)
        throw new ShopifyApiError(
          'UNCERTAIN',
          'The previous creation is unconfirmed. Check Shopify before trying again.',
        )
    }
    if (remoteId) {
      const existing = await call<{ article: RemoteArticle | null }>(
        `query TopiquArticle($id: ID!) { article(id: $id) { ${ARTICLE_FIELDS} } }`,
        { id: remoteId },
      )
      if (!existing.article || existing.article.marker?.value !== publication.articleId)
        throw new ShopifyApiError('REJECTED', 'The linked Shopify article is missing or was reassigned')
      // Persist a recovered ID before updating, including if the next request fails.
      await prisma.shopifyPublication.updateMany({
        where: { id, lease, status: 'PUBLISHING' },
        data: {
          shopifyArticleId: remoteId,
          ...(recovered ? { blogId: recovered.blog.id, handle: recovered.handle } : {}),
        },
      })
    }
    const active = await prisma.shopifyConnection.count({
      where: { id: publication.connectionId, status: 'CONNECTED' },
    })
    if (!active) throw new ShopifyApiError('REJECTED', 'Shopify disconnected')
    const input = {
      ...payload,
      ...(recovered ? { blogId: recovered.blog.id, handle: recovered.handle } : {}),
      metafields: [
        { namespace: 'topiqu', key: 'article_id', type: 'single_line_text_field', value: publication.articleId },
      ],
    }
    const mutation = remoteId ? 'articleUpdate' : 'articleCreate'
    const authorized = await prisma.shopifyPublication.updateMany({
      where: { id, status: 'PUBLISHING', lease, clientSite: { publishToShopify: true } },
      data: { leaseUntil: new Date(Date.now() + 120_000), ...(!remoteId ? { createStartedAt: new Date() } : {}) },
    })
    if (!authorized.count) {
      await finish({ status: 'QUEUED', attempts: { decrement: 1 } })
      return
    }
    creating = !remoteId
    const result = await call<Record<string, { article: RemoteArticle | null; userErrors: { message: string }[] }>>(
      remoteId
        ? `mutation TopiquUpdateArticle($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { ${ARTICLE_FIELDS} } userErrors { message } } }`
        : `mutation TopiquCreateArticle($article: ArticleCreateInput!) { articleCreate(article: $article) { article { ${ARTICLE_FIELDS} } userErrors { message } } }`,
      { ...(remoteId ? { id: remoteId } : {}), article: input },
      true,
    )
    const operation = result[mutation]
    if (operation?.userErrors.length) {
      if (!remoteId)
        await prisma.shopifyPublication.updateMany({ where: { id, lease }, data: { createStartedAt: null } })
      throw new ShopifyApiError('REJECTED', 'Shopify rejected the article. Check the blog and article fields.')
    }
    if (!operation?.article) throw new ShopifyApiError('UNCERTAIN', 'Shopify did not confirm the saved article')
    const remote = operation.article
    const storefront = new URL(publication.connection.storefrontUrl)
    if (storefront.protocol !== 'https:') throw new ShopifyApiError('REJECTED', 'Invalid Shopify storefront URL')
    await finish({
      status: 'SYNCED',
      shopifyArticleId: remote.id,
      handle: remote.handle,
      url: `${storefront.origin}/blogs/${encodeURIComponent(remote.blog.handle)}/${encodeURIComponent(remote.handle)}`,
      isPublished: remote.isPublished,
      lastSyncedAt: new Date(),
      lastError: null,
    })
  } catch (error) {
    const failure =
      error instanceof ShopifyApiError
        ? error
        : new ShopifyApiError('UNCERTAIN', 'Shopify publication could not be confirmed')
    if (creating && failure.code !== 'UNCERTAIN')
      await prisma.shopifyPublication.updateMany({
        where: { id, lease, status: 'PUBLISHING' },
        data: { createStartedAt: null },
      })
    if (failure.code === 'REAUTH_REQUIRED')
      await prisma.shopifyConnection.updateMany({
        where: { id: publication.connectionId, status: 'CONNECTED' },
        data: { status: 'REAUTH_REQUIRED' },
      })
    await finish({
      status:
        failure.code === 'UNCERTAIN'
          ? 'UNCERTAIN'
          : failure.code === 'RETRY' && publication.attempts < 5
            ? 'QUEUED'
            : 'FAILED',
      nextAttemptAt: new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** publication.attempts)),
      lastError: failure.message,
    })
  }
}
