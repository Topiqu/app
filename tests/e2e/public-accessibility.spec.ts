import { expect, test } from '@playwright/test'

import { expectAccessible, expectNoHorizontalOverflow, preparePage } from './helpers'

const productRoutes = ['', '/auth', '/terms-of-service', '/privacy-policy', '/route-that-does-not-exist']

const productLocale = (projectName: string) => (projectName.endsWith('-cs') ? 'cs' : 'en')
const localizedProductRoute = (locale: string, route: string) => {
  if (locale === 'en') return `/en${route}`
  const paths: Record<string, string> = {
    '': '',
    '/auth': '/autorizace',
    '/terms-of-service': '/obchodni-podminky',
    '/privacy-policy': '/ochrana-soukromi',
    '/route-that-does-not-exist': '/route-that-does-not-exist',
  }
  return `/cs${paths[route] ?? route}`
}

for (const route of productRoutes) {
  test(`${route || '/'} is stable and accessible`, async ({ page }, testInfo) => {
    const localizedRoute = localizedProductRoute(productLocale(testInfo.project.name), route)
    await preparePage(page, { expectedErrorPage: localizedRoute.includes('route-that') })
    await page.goto(localizedRoute)
    await expect(page.locator('body')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page, localizedRoute.includes('route-that') ? ['nested-interactive'] : [])
  })
}

test('onboarding is a viewport-safe guided dialog', async ({ page }, testInfo) => {
  await preparePage(page)
  await page.goto(`/${productLocale(testInfo.project.name)}`)
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const trigger = page.getByRole('link', { name: /Start Integration|Get Started|Začít|Spustit integraci/ }).first()
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS('max-height', /.+/)
  await expectAccessible(page)
  await dialog.focus()
  await dialog.press('Escape')
  if (await dialog.isVisible()) await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('guest header popovers remain readable and keyboard accessible', async ({ page }) => {
  await preparePage(page)
  await page.goto('http://localhost:4173/cs')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

  const account = page.getByRole('button', { name: /Log In|Přihlásit se/i }).first()
  await account.click()
  await expect(page.getByText(/Welcome back|Vítejte zpět/i)).toBeVisible()
  await expectAccessible(page)
  await page.keyboard.press('Escape')
  await expect(account).toBeFocused()

  const notifications = page.getByRole('button', { name: /Open notifications|Otevřít oznámení/i })
  await notifications.click()
  await expect(page.getByText(/Přihlaste se a sledujte novinky/i)).toBeVisible()
  await expectAccessible(page)
  await page.keyboard.press('Escape')
  await expect(notifications).toBeFocused()
})

test('OAuth entry without a provider returns safely to the landing page', async ({ page }, testInfo) => {
  await preparePage(page)
  await page.goto(`/${productLocale(testInfo.project.name)}/oauth-start`)
  await expect(page).toHaveURL(new RegExp(`/${productLocale(testInfo.project.name)}/?$`))
  await expectNoHorizontalOverflow(page)
})

const tenantRoutes = ['/cs', '/cs/clanky/jak-postavit-udrzitelnou-redakci', '/cs/autor/admin', '/cs/stitky/redakce']

for (const route of tenantRoutes) {
  test(`tenant ${route} is stable and accessible`, async ({ page }) => {
    await preparePage(page)
    await page.goto(`http://localhost:4173${route}`)
    await expect(page.locator('main, article').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
  })
}

test('empty tenant publication has a complete empty state', async ({ page }) => {
  await preparePage(page)
  await page.goto('http://empty.localhost:4173/cs')
  await expect(page.locator('main')).toBeVisible()
  const primaryCta = page.locator('[data-primary-cta]')
  await expect(primaryCta).toHaveCount(1)
  await expect(primaryCta).toHaveAttribute('href', '#articles')
  await expectNoHorizontalOverflow(page)
  await expectAccessible(page)
})
