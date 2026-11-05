import { expect, test } from '@playwright/test'

import { preparePage, waitForPageReady } from './helpers'

const articleUrl = 'http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci'

test('SSR includes application styles and hashed assets support origin compression', async ({ request }) => {
  const document = await request.get('/en')
  expect(document.status()).toBe(200)
  const html = await document.text()
  // Global styles must be available before JavaScript runs, without a blocking entry CSS fetch.
  expect(html).toMatch(/<style\b[^>]*>[\s\S]*?--topiqu-header-height/)
  expect(html).not.toMatch(/<link\b[^>]*rel="stylesheet"[^>]*href="[^"]*\/entry\.[^"]+\.css"/)
  const script = html.match(/<script\b[^>]*src="([^"]*\/_nuxt\/[^"]+\.js)"/)
  expect(script).toBeTruthy()
  const asset = await request.get(script![1]!, { headers: { 'accept-encoding': 'gzip' } })
  expect(asset.status()).toBe(200)
  expect(asset.headers()['content-encoding']).toBe('gzip')
  expect(asset.headers().vary).toContain('Accept-Encoding')
  expect(asset.headers()['cache-control']).toContain('immutable')
  expect((await asset.body()).length).toBeGreaterThan(1024)
})

test('IPX preserves image headers, conditional requests and host restrictions', async ({ request }) => {
  const url = '/_ipx/w_80&f_webp&q_82/topik_normal_rm.png'
  const response = await request.get(url)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/^image\/webp/)
  expect(response.headers()['cache-control']).toContain('max-age=86400')
  expect(response.headers()['content-security-policy']).toContain("default-src 'none'")
  const etag = response.headers().etag
  expect(etag).toBeTruthy()
  expect((await request.get(url, { headers: { 'if-none-match': etag! } })).status()).toBe(304)
  const denied = await request.get('/_ipx/w_80/https://example.invalid/private.png')
  expect(denied.status()).toBe(403)
})

test('renders a signed runtime article OG image with the installed native renderer', async ({ request }) => {
  const document = await request.get(articleUrl)
  expect(document.status()).toBe(200)
  const html = await document.text()
  const meta = [...html.matchAll(/<meta\b[^>]*>/g)].find(([tag]) => /\bproperty="og:image"/.test(tag))?.[0]
  const source = meta?.match(/\bcontent="([^"]+)"/)?.[1]
  expect(source).toBeTruthy()
  const imageUrl = new URL(source!.replaceAll('&amp;', '&'), articleUrl)
  expect(imageUrl.pathname).toMatch(/^\/_og\/d\//)
  const image = await request.get(new URL(imageUrl.pathname + imageUrl.search, articleUrl).href)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toMatch(/^image\/(png|jpeg|webp)/)
  const body = await image.body()
  expect(body.byteLength).toBeGreaterThan(1024)
  await test.info().attach('article-og-image', { body, contentType: image.headers()['content-type']! })
})

test('service-worker activation removes legacy private responses and never serves them offline', async ({ page }) => {
  await preparePage(page)
  await page.goto('http://localhost:4173/api/live')
  await page.evaluate(async () => {
    const cache = await caches.open('api-cache')
    await cache.put(
      '/api/auth/get-session',
      new Response(JSON.stringify({ user: { id: 'synthetic-account-a' } }), {
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
  await page.goto(articleUrl)
  await waitForPageReady(page)
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).includes('api-cache')), { timeout: 20_000 })
    .toBe(false)
  await page.reload()
  await waitForPageReady(page)
  await page.context().setOffline(true)
  const result = await page.evaluate(async () => {
    try {
      await fetch('/api/auth/get-session')
      return 'network-response'
    } catch {
      return 'offline'
    }
  })
  expect(result).toBe('offline')
})

test('production article assets stay loadable across service-worker activation', async ({ page, request }) => {
  await preparePage(page)
  await page.goto(articleUrl)
  await waitForPageReady(page)

  await expect(page.locator('article').first()).toBeVisible()
  await expect(page.locator('[integrity]'), 'Build output must not pin mutable chunks with SRI').toHaveCount(0)

  const assetUrls = await page
    .locator('script[src], link[rel="stylesheet"], link[rel="modulepreload"]')
    .evaluateAll((elements) => [
      ...new Set(
        elements
          .map((element) => (element instanceof HTMLScriptElement ? element.src : (element as HTMLLinkElement).href))
          .filter((url) => url && new URL(url).origin === location.origin),
      ),
    ])
  expect(assetUrls.length, 'The production document must reference built assets').toBeGreaterThan(0)
  for (const url of assetUrls) {
    const response = await request.get(url)
    expect(response.ok(), `${url} must exist in the same release as its HTML`).toBe(true)
  }

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          return registration?.active?.scriptURL ?? null
        }),
      { timeout: 20_000 },
    )
    .toMatch(/\/sw\.js$/)

  await page.reload()
  await waitForPageReady(page)
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), { timeout: 10_000 })
    .toMatch(/\/sw\.js$/)
  await expect(page.locator('article').first()).toBeVisible()

  const serviceWorker = await request.get('/sw.js')
  expect(serviceWorker.ok()).toBe(true)
  expect(serviceWorker.headers()['cache-control']).toContain('no-store')
  expect(await serviceWorker.text()).not.toMatch(/createHandlerBoundToURL\((['"])\/\1\)/)
})

// Plain requests, no browser: only the server-rendered auth state can decide this redirect.
test('a signed-in session survives server rendering', async ({ request, baseURL }) => {
  const signIn = await request.post('/api/auth/sign-in/credentials', {
    headers: { origin: baseURL! },
    data: { email: 'reader@test.local', password: 'test1234' },
  })
  expect(signIn.ok(), 'credentials sign-in must open a session').toBe(true)

  const profile = await request.get('/cs/uzivatel', { maxRedirects: 0 })
  expect(profile.status(), 'SSR must see the session instead of redirecting to sign-in').toBe(200)
  expect(await profile.text()).toContain('reader@test.local')
})

// The route imports pdfkit at load, so a broken bundle answers 500 before any handler runs.
test('profile PDF export renders in the production bundle', async ({ request, baseURL }) => {
  const signIn = await request.post('/api/auth/sign-in/credentials', {
    headers: { origin: baseURL! },
    data: { email: 'reader@test.local', password: 'test1234' },
  })
  expect(signIn.ok(), 'credentials sign-in must open a session').toBe(true)

  const pdf = await request.get('/api/users/pdf')
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toContain('application/pdf')
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
})
