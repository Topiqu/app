import { expect, test } from '@playwright/test'

import { expectNoHorizontalOverflow, preparePage } from './helpers'

test('public startup preserves CSP and generates useful image candidates and a font preload', async ({ page }) => {
  await page.addInitScript(() => {
    const violations: string[] = []
    Object.assign(window, { startupCspViolations: violations })
    document.addEventListener('securitypolicyviolation', (event) => violations.push(event.blockedURI))
  })
  await page.goto('http://localhost:4173/en')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveAttribute('crossorigin', 'anonymous')
  const srcsets = await page
    .locator('.app-media img[srcset]')
    .evaluateAll((images) => images.map((image) => image.getAttribute('srcset')!))
  expect(srcsets.length).toBeGreaterThan(0)
  expect(srcsets.every((srcset) => !/\s[12]w(?:,|$)/.test(srcset))).toBe(true)
  expect(srcsets.some((srcset) => /\s480w(?:,|$)/.test(srcset))).toBe(true)
  expect(
    await page.evaluate(() => (window as Window & { startupCspViolations: string[] }).startupCspViolations),
  ).not.toContain('eval')

  await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cookie settings', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('switch').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
  await expect(dialog).toBeVisible()
})

test('header controls hydrate and open on the first click', async ({ page }) => {
  await page.goto('http://localhost:4173/en')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.getByRole('button', { name: 'Log In', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Log In', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Interface language', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
})

test('locale dropdown selects a language and remains usable after navigation', async ({ page }) => {
  await preparePage(page, { allowCancelledRequests: true })
  await page.goto('http://localhost:4173/en')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.getByRole('button', { name: 'Interface language', exact: true }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Čeština', exact: true }).click()
  await expect(page).toHaveURL(/\/cs(?:\/|$)/)
  await page.getByRole('button', { name: 'Jazyk rozhraní', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expectNoHorizontalOverflow(page)
})

test('author hover card opens and dismisses without navigating', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'), 'Hover interaction requires a pointer')
  await preparePage(page)
  await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const author = page.locator('a[href*="/autor/"]').first()
  await author.hover()
  await expect(page.locator('[data-user-card-popover]')).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(page.locator('[data-user-card-popover]')).toBeHidden()
  await expect(page).toHaveURL(/\/clanky\/jak-postavit-udrzitelnou-redakci$/)
})

test('search retains results and their space while a slow request becomes empty', async ({ page }) => {
  await preparePage(page)
  await page.goto('http://localhost:4173/cs')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const consent = page.getByRole('button', { name: 'Odmítnout volitelné', exact: true })
  if (await consent.isVisible()) await consent.click()
  await page.getByRole('group', { name: 'Prozkoumat témata' }).getByRole('button').first().click()
  const results = page.locator('[data-feed-results]')
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.locator('[data-editorial-article]').first()).toBeVisible()
  const height = await results.evaluate((element) => element.getBoundingClientRect().height)

  await page.route('**/api/articles/by-clientsite/**', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await route.fulfill({ response, json: { ...body, items: [], hasMore: false } })
  })
  await page.getByRole('searchbox', { name: 'Hledat články...' }).fill('no-matching-article')
  await expect(results).toHaveAttribute('aria-busy', 'true')
  await expect(results.locator('[data-editorial-article]').first()).toBeVisible()
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(results.locator('[data-editorial-article]')).toHaveCount(0)
  expect(await results.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
    Math.min(height, page.viewportSize()!.height) - 1,
  )
  await expectNoHorizontalOverflow(page)
})

test('critical article media is visible without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
    const image = page.locator('.app-media img[width="1200"][height="675"]')
    await expect(image).toHaveAttribute('fetchpriority', 'high')
    await expect(image).toHaveAttribute('srcset', /768w/)
    await expect(image).toHaveAttribute('loading', 'eager')
    await expect(image).toHaveCSS('opacity', '1')
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  } finally {
    await context.close()
  }
})

test('guests without Marketing consent do not bootstrap advertising', async ({ page }) => {
  const advertising: string[] = []
  page.on('request', (request) => {
    if (/pagead2\.googlesyndication\.com|securepubads\.g\.doubleclick\.net/.test(request.url()))
      advertising.push(request.url())
  })
  await page.goto('http://localhost:4173/cs')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('link[rel="prefetch"][as="script"]')).toHaveCount(0)
  expect(await page.locator('link[rel="modulepreload"]').count()).toBeGreaterThan(0)
  await expect(page.locator('script[src*="adsbygoogle"], script[src*="gpt.js"]')).toHaveCount(0)
  expect(advertising).toEqual([])
})

test.describe('private loading boundaries', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' })

  test('tag management loads on first keyboard opening and restores focus when closed', async ({ page }) => {
    await preparePage(page)
    await page.goto('/cs/admin')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    const trigger = page.getByRole('button', { name: 'Spravovat štítky', exact: true })
    await trigger.focus()
    await trigger.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-tag-id]').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    await trigger.press('Enter')
    await expect(dialog.locator('[data-tag-id]').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
