// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { shopifyGraphql } from '../../../server/utils/shopify/api'
import { createDatabaseClient } from '../../../server/utils/database'
import { encryptShopifyToken } from '../../../server/utils/shopify/security'
import { publishShopifyArticle } from '../../../server/utils/shopify/publication'

vi.mock('../../../server/utils/shopify/api', async (original) => ({ ...(await original<typeof import('../../../server/utils/shopify/api')>()), shopifyGraphql: vi.fn() }))

const url = process.env.TEST_DATABASE_URL
const enabled = Boolean(url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL)
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []

describe.skipIf(!enabled)('Shopify PostgreSQL constraints, policies, and leases', () => {
  beforeAll(() => {
    vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    vi.stubGlobal('prisma', db)
  })
  afterAll(async () => {
    for (const id of sites) await db!.clientSite.delete({ where: { id } })
    await db?.$disconnect()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const fixture = async () => {
    const id = randomUUID()
    const site = await db!.clientSite.create({ data: { name: `shopify-${id}`, domain: `${id}.test`, plan: 'PRO' } })
    sites.push(site.id)
    const user = await db!.user.create({ data: { username: id, email: `${id}@example.test`, role: 'admin', clientSiteId: site.id } })
    const article = await db!.article.create({ data: { userId: user.id, clientSiteId: site.id, slug: 'article', title: 'Title', content: '<p>Article</p>', language: 'en' } })
    const connection = await db!.shopifyConnection.create({ data: {
      clientSiteId: site.id, shop: `s-${id}.myshopify.com`, shopName: 'Store', storefrontUrl: 'https://store.example', blogId: 'gid://shopify/Blog/1', author: 'Topiqu',
      encryptedAccessToken: encryptShopifyToken('token'), encryptedRefreshToken: encryptShopifyToken('refresh'),
      accessTokenExpiresAt: new Date(Date.now() + 3600_000), refreshTokenExpiresAt: new Date(Date.now() + 86400_000), grantedScopes: ['write_content'],
    } })
    return { site, user, article, connection }
  }

  it('omits tokens and blocks reading and changing another tenant connection', async () => {
    const a = await fixture()
    const b = await fixture()
    const tenantDb = db!.$use(new PolicyPlugin()).$setAuth({ id: a.user.id, role: 'admin', clientSiteId: a.site.id })
    const own = await tenantDb.shopifyConnection.findUnique({ where: { id: a.connection.id } })
    expect(own).not.toHaveProperty('encryptedAccessToken')
    expect(own).not.toHaveProperty('encryptedRefreshToken')
    expect(await tenantDb.shopifyConnection.findUnique({ where: { id: b.connection.id } })).toBeNull()
    expect(await tenantDb.shopifyConnection.updateMany({ where: { id: b.connection.id }, data: { author: 'Attacker' } })).toMatchObject({ count: 0 })
    expect(await db!.shopifyConnection.findUnique({ where: { id: b.connection.id }, select: { author: true } })).toMatchObject({ author: 'Topiqu' })
  })

  it('keeps store ownership unique across projects', async () => {
    const a = await fixture()
    const b = await fixture()
    await expect(db!.shopifyConnection.update({ where: { id: b.connection.id }, data: { shop: a.connection.shop } })).rejects.toThrow()
  })

  it('only lets one worker publish despite concurrent claims on PostgreSQL', async () => {
    const f = await fixture()
    const publication = await db!.shopifyPublication.create({ data: {
      clientSiteId: f.site.id, articleId: f.article.id, connectionId: f.connection.id, blogId: 'gid://shopify/Blog/1', handle: 'article-unique',
      payload: { blogId: 'gid://shopify/Blog/1', handle: 'article-unique', title: 'Title', author: { name: 'Topiqu' }, body: '<p>Article</p>', summary: '', tags: [], isPublished: false },
    } })
    vi.mocked(shopifyGraphql).mockReset().mockResolvedValueOnce({ articles: { nodes: [] } }).mockResolvedValueOnce({ articleCreate: { article: {
      id: 'gid://shopify/Article/1', handle: 'article-unique', isPublished: false, blog: { id: 'gid://shopify/Blog/1', handle: 'news' }, marker: { value: f.article.id },
    }, userErrors: [] } })
    await Promise.all([publishShopifyArticle(publication.id), publishShopifyArticle(publication.id)])
    const saved = await db!.shopifyPublication.findUnique({ where: { id: publication.id } })
    expect(saved).toMatchObject({ status: 'SYNCED', shopifyArticleId: 'gid://shopify/Article/1', attempts: 1, leaseUntil: null })
    expect(vi.mocked(shopifyGraphql).mock.calls.filter((call) => call[4])).toHaveLength(1)
    expect(await db!.article.findUnique({ where: { id: f.article.id }, select: { status: true } })).toMatchObject({ status: 'draft' })
  })
})
