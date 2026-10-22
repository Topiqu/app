import { expect, test } from '@playwright/test'

import { preparePage } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/admin.json' })

test('Web and Dashboard navigate in the same tab while retaining the authorized publication sidebar', async ({
  page,
  context,
  isMobile,
}, testInfo) => {
  const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
  const origin = 'http://localhost:4173'
  const signedIn = await page.request.post(`${origin}/api/auth/sign-in/credentials`, {
    headers: { Origin: origin },
    data: { email: 'admin@test.local', password: 'test1234' },
  })
  expect(signedIn.ok()).toBe(true)
  await preparePage(page)
  await page.goto(`${origin}/${locale}/admin`)
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const logo = page.getByRole('banner').getByRole('link', { name: 'topiqu-dev', exact: true })
  await expect(logo).toHaveAttribute('href', `/${locale}`)
  const openMenu = page.getByRole('button', { name: /^(Open navigation|Otevřít navigaci)$/ })
  if (isMobile) await openMenu.click()
  const web = page.getByRole('link', { name: /^(Web|Website)$/ })
  const write = page.getByRole('link', { name: /^(Write article|Napsat článek)$/ })
  const setup = page.getByRole('button', { name: /^(Getting started|Začínáme)$/ })
  await expect(web).toHaveAttribute('href', `/${locale}`)
  await expect(setup).toBeVisible()
  expect(await web.getAttribute('target')).toBeNull()
  const adminButtonBackground = await write.evaluate((element) => getComputedStyle(element).backgroundColor)
  const adminActiveColor = await page
    .getByRole('link', { name: /^(Dashboard|Přehled)$/ })
    .evaluate((element) => getComputedStyle(element).color)
  await page.evaluate(() => Object.assign(window, { topiquNavigationProbe: true }))
  const tabs = context.pages().length
  await web.click()
  await expect(page).toHaveURL(`${origin}/${locale}`)
  await expect(page.locator('[data-editorial-hero]')).toBeVisible()
  expect(context.pages().length).toBe(tabs)
  expect(await page.evaluate(() => Reflect.get(window, 'topiquNavigationProbe'))).toBe(true)
  if (isMobile) await openMenu.click()
  await expect(web).toHaveAttribute('aria-current', 'page')
  await expect(setup).toBeVisible()
  expect(await write.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(adminButtonBackground)
  expect(await web.evaluate((element) => getComputedStyle(element).color)).toBe(adminActiveColor)
  const publicationCta = page.locator('[data-editorial-hero] .publication-primary-cta')
  expect(await publicationCta.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    adminButtonBackground,
  )
  const dashboard = page.getByRole('link', { name: /^(Dashboard|Přehled)$/ })
  await expect(dashboard).toBeVisible()
  await expect(dashboard).not.toHaveAttribute('aria-current', 'page')
  await dashboard.click()
  await expect(page).toHaveURL(`${origin}/${locale}/admin`)
  await expect(logo).toHaveAttribute('href', `/${locale}`)
  await logo.click()
  await expect(page).toHaveURL(`${origin}/${locale}`)
  await expect(page.locator('[data-editorial-hero]')).toBeVisible()
  if (isMobile) await openMenu.click()
  await setup.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(`${origin}/${locale}/admin`)
  await expect(page.locator('[data-setup-checklist]')).toBeVisible()
  await expect(page.locator('[data-setup-toggle]')).toHaveAttribute('aria-expanded', 'true')
})

test('the central Topiqu logo leads to the dashboard and Open site stays external in the footer', async ({
  page,
}, testInfo) => {
  const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
  await page.goto(`/${locale}/admin`)
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Topiqu', exact: true })).toHaveAttribute(
    'href',
    `/${locale}/admin`,
  )
  if ((page.viewportSize()?.width ?? 0) < 1024)
    await page.getByRole('button', { name: /^(Open navigation|Otevřít navigaci)$/ }).click()
  await expect(page.getByRole('link', { name: /^(Web|Website)$/ })).toHaveCount(0)
  const openSite = page.locator('[data-slot="footer"]').getByRole('link', { name: /^(Open site|Otevřít web)$/ })
  await expect(openSite).toBeVisible()
  await expect(openSite).toHaveAttribute('href', 'http://localhost:4173/cs')
  await expect(openSite).toHaveAttribute('target', '_blank')
  await expect(openSite).toHaveAttribute('rel', /noopener/)
})

test('Web navigation preserves the editor confirmation and unsaved draft', async ({ page }, testInfo) => {
  const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
  const origin = 'http://localhost:4173'
  const signedIn = await page.request.post(`${origin}/api/auth/sign-in/credentials`, {
    headers: { Origin: origin },
    data: { email: 'admin@test.local', password: 'test1234' },
  })
  expect(signedIn.ok()).toBe(true)
  await page.goto(`${origin}/${locale}/admin/editor/new`)
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const title = page.getByPlaceholder(/^(Article title|Název článku)$/)
  await title.fill('Unsaved navigation check')
  if ((page.viewportSize()?.width ?? 0) < 1024)
    await page.getByRole('button', { name: /^(Open navigation|Otevřít navigaci)$/ }).click()
  await page.getByRole('link', { name: /^(Web|Website)$/ }).click()
  await expect(page.getByRole('dialog')).toContainText(/unsaved|neuložen/i)
  await expect(page).toHaveURL(`${origin}/${locale}/admin/editor/new`)
  await expect(title).toHaveValue('Unsaved navigation check')
})

test('foreign publications do not show administration from another tenant', async ({ page, context }) => {
  const cookies = await context.cookies('http://127.0.0.1:4173')
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: 'empty.localhost' })))
  await preparePage(page)
  await page.goto('http://empty.localhost:4173/cs')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const session = await page.request.get('http://empty.localhost:4173/api/auth/get-session')
  expect((await session.json()).user.role).toBe('admin')
  await expect(page.locator('[data-collapsed]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Otevřít navigaci', exact: true })).toHaveCount(0)
})

test('collapsed desktop sidebar keeps its controls inside its width', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop collapsed rail is replaced by a drawer on mobile.')
  await preparePage(page)
  await page.goto('/cs/admin')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const sidebar = page.locator('div[data-slot="root"][data-collapsed]')
  await expect(sidebar).toBeVisible()
  if ((await sidebar.getAttribute('data-collapsed')) !== 'true')
    await sidebar.getByRole('button', { name: 'Sbalit postranní panel', exact: true }).click()
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
  await expect
    .poll(() =>
      sidebar.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return (
          [...element.querySelectorAll('button, a')].every((control) => {
            const box = control.getBoundingClientRect()
            return box.width === 0 || (box.left >= bounds.left && box.right <= bounds.right)
          }) && element.scrollWidth <= element.clientWidth
        )
      }),
    )
    .toBe(true)
})
