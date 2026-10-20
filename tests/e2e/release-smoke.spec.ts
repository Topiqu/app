import { expect, test } from '@playwright/test'

import { preparePage, waitForPageReady } from './helpers'

const articleUrl = 'http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci'

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
