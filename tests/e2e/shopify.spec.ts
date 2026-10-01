import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

import { createDatabaseClient } from '../../server/utils/database'

test.use({ storageState: { cookies: [], origins: [] } })
let db: ReturnType<typeof createDatabaseClient>
let siteId: string
let email: string

const status = (connected = true) => ({
  configured: true,
  eligible: true,
  canManage: true,
  canPublish: true,
  billingProvider: 'STRIPE',
  pricingUrl: null,
  adminUrl: 'https://admin.shopify.com/store/test-store/apps/topiqu',
  installUrl: 'https://apps.shopify.com/topiqu',
  pending: connected
    ? null
    : { shop: 'test-store.myshopify.com', shopName: 'Test store', project: 'Shopify project', shopifyBilling: false },
  connection: connected
    ? {
        shop: 'test-store.myshopify.com',
        shopName: 'Test store',
        blogId: 'gid://shopify/Blog/1',
        blogTitle: 'News',
        author: 'Topiqu',
        status: 'CONNECTED',
      }
    : null,
})

test.beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL
  if (!url || !/test/i.test(new URL(url).pathname) || url === process.env.DATABASE_URL)
    throw new Error('Shopify browser fixtures require a separate test database')
  db = createDatabaseClient(url)
  const id = randomUUID()
  const seed = await db.user.findUnique({ where: { email: 'admin@test.local' }, select: { password: true } })
  const site = await db.clientSite.create({
    data: { name: `shopify-browser-${id}`, domain: `${id}.test`, plan: 'PRO', language: 'en' },
  })
  siteId = site.id
  email = `shopify-${id}@test.local`
  const user = await db.user.create({
    data: { email, username: `shopify-${id}`, password: seed!.password, role: 'admin', clientSiteId: siteId },
  })
  await db.tenantMembership.create({ data: { clientSiteId: siteId, userId: user.id, role: 'OWNER', scopes: [] } })
  await db.article.create({
    data: {
      clientSiteId: siteId,
      userId: user.id,
      title: 'Shopify test article',
      slug: 'shopify-test-article',
      content: '<p>A saved article for the Shopify integration.</p>',
      excerpt: 'Test article summary.',
      language: 'en',
    },
  })
})
test.afterAll(async () => {
  if (siteId) await db.clientSite.delete({ where: { id: siteId } })
  await db?.$disconnect()
})
test.beforeEach(async ({ page }) => {
  await page.goto('/en/auth')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test1234')
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/callback/credentials')),
    page.getByRole('button', { name: 'Log In', exact: true }).last().click(),
  ])
})

test('confirms a store opened from Shopify and saves the selected blog', async ({ page }) => {
  let connected = false
  let saved = false
  await page.route('**/api/shopify/status', (route) => route.fulfill({ json: status(connected) }))
  await page.route('**/api/shopify/link', async (route) => {
    expect(route.request().method()).toBe('POST')
    connected = true
    await route.fulfill({ json: { success: true } })
  })
  await page.route('**/api/shopify/blogs', (route) =>
    route.fulfill({ json: [{ id: 'gid://shopify/Blog/1', title: 'News', handle: 'news' }] }),
  )
  await page.route('**/api/shopify/settings', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ blogId: 'gid://shopify/Blog/1', author: 'Editor' })
    saved = true
    await route.fulfill({ json: { success: true } })
  })
  await page.goto('/en/settings?tab=integrations&shopify=link')
  const settings = page.locator('[data-shopify-settings]')
  await expect(settings.getByText('Connect Test store to Topiqu?')).toBeVisible({ timeout: 20_000 })
  await settings.getByRole('button', { name: 'Connect store', exact: true }).click()
  await expect(settings.getByText('Test store', { exact: true })).toBeVisible({ timeout: 20_000 })
  await settings.getByLabel('Author name').fill('Editor')
  await settings.getByRole('button', { name: 'Save', exact: true }).click()
  await expect.poll(() => saved).toBe(true)
  await page.screenshot({ path: test.info().outputPath('shopify-settings.png'), fullPage: true })
})

test('publishes to Shopify from the publish dialog and disables sending after an unsaved title change', async ({
  page,
}) => {
  await page.route('**/api/shopify/status', (route) => route.fulfill({ json: status() }))
  let sent = false
  const remote = {
    id: 'publication-1',
    status: 'SYNCED',
    shopifyArticleId: 'gid://shopify/Article/1',
    url: 'https://test-store.example/blogs/news/article',
    isPublished: true,
    lastSyncedAt: null,
    lastError: null,
  }
  await page.route('**/api/articles/*/shopify', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: sent ? remote : null })
    expect(route.request().postDataJSON()).toEqual({ mode: 'published' })
    sent = true
    return route.fulfill({ json: remote })
  })
  await page.goto('/en/admin/editor/shopify-test-article')
  const shopify = page.locator('[data-shopify-status]')
  await expect(shopify).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-editor-command-bar]').getByRole('button', { name: 'Publish', exact: true }).click()
  const dialog = page.locator('[data-publish-dialog]')
  await expect(dialog.getByLabel('Topiqu blog', { exact: true })).toBeChecked()
  await expect(dialog.getByLabel('Shopify', { exact: true })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Published', exact: true }).click()
  await page.screenshot({ path: test.info().outputPath('shopify-publish-dialog.png'), fullPage: true })
  await page.locator('[data-publish-confirm]').click()
  await expect.poll(() => sent).toBe(true)
  await expect(page.locator('[data-editor-command-bar]').getByRole('button', { name: 'Save changes' })).toBeVisible()

  await shopify.click()
  const publication = page.locator('[data-shopify-publication]')
  await expect(publication.getByRole('button', { name: 'Update in Shopify', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('shopify-editor.png'), fullPage: true })
  await page.keyboard.press('Escape')
  const title = page.getByRole('textbox', { name: 'Article title', exact: true })
  await title.fill('Unsaved title change')
  await shopify.click()
  await expect(publication.getByRole('button', { name: 'Send as draft', exact: true })).toBeDisabled()
  await expect(publication.getByText('Save the article in Topiqu before sending it to Shopify.')).toBeVisible()
})
