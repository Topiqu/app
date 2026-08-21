import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { expectAccessible, expectNoHorizontalOverflow, expectOverlayWithinViewport, preparePage } from './helpers'

const authDir = join(process.cwd(), 'tests/e2e/.auth')
const localeFor = (projectName: string) => (projectName.endsWith('-cs') ? 'cs' : 'en')

test.describe('reader', () => {
  test.use({ storageState: join(authDir, 'reader.json') })

  test('profile', async ({ page }, testInfo) => {
    await preparePage(page)
    const locale = localeFor(testInfo.project.name)
    await page.goto(`/${locale}/${locale === 'cs' ? 'uzivatel' : 'user'}`)
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('reader-profile.png', { fullPage: true })
  })

  test('profile save actions only appear after an edit', async ({ page }, testInfo) => {
    await preparePage(page)
    const locale = localeFor(testInfo.project.name)
    await page.goto(`/${locale}/${locale === 'cs' ? 'uzivatel' : 'user'}`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    const save = page.getByRole('button', { name: /Save changes|Uložit změny/i })
    await expect(save).toHaveCount(0)
    const username = page.getByRole('textbox', { name: /Username|Uživatelské jméno/i }).first()
    await username.fill(`${await username.inputValue()} edited`)
    await expect(save).toBeVisible()
    await expect(page.getByText(/Unsaved changes|Neuložené změny/i)).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('profile metrics share one geometry and the page reaches its end', async ({ page }, testInfo) => {
    await preparePage(page)
    const locale = localeFor(testInfo.project.name)
    await page.goto(`/${locale}/${locale === 'cs' ? 'uzivatel' : 'user'}`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    const metrics = page.locator('[data-profile-metric]')
    await expect(metrics).toHaveCount(5)
    const heights = await metrics.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect
      .poll(() => page.evaluate(() => window.scrollY + window.innerHeight))
      .toBeGreaterThanOrEqual(await page.evaluate(() => document.documentElement.scrollHeight - 1))
  })
})

test.describe('admin', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  for (const route of ['/admin', '/settings', '/admin/editor/new']) {
    test(route, async ({ page }, testInfo) => {
      await preparePage(page)
      await page.goto(`/${localeFor(testInfo.project.name)}${route}`)
      await expect(page.locator('main')).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectAccessible(page)
      await expect(page).toHaveScreenshot(`admin-${route.replaceAll('/', '-')}.png`, { fullPage: true })
    })
  }

  test('dashboard shell and square controls have non-overlapping geometry', async ({ page }, testInfo) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop dashboard geometry')
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/admin/editor/new`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    const header = page.locator('header').first()
    const sidebar = page.locator('[data-slot="root"][data-collapsed]').first()
    const main = page.locator('main').first()
    const [headerBox, sidebarBox, mainBox] = await Promise.all([
      header.boundingBox(),
      sidebar.boundingBox(),
      main.boundingBox(),
    ])
    expect(headerBox).not.toBeNull()
    expect(sidebarBox).not.toBeNull()
    expect(mainBox).not.toBeNull()
    expect(sidebarBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1)
    expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width - 1)

    const squareControls = page.locator('button[data-slot="base"][aria-label]')
    const boxes = await squareControls.evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          box: node.getBoundingClientRect(),
          label: node.getAttribute('aria-label'),
          classes: node.className,
        }))
        .filter(({ classes }) => /(?:^|\s)size-(?:8|9|10|11)(?:\s|$)/.test(classes))
        .map(({ box, label, classes }) => ({ width: box.width, height: box.height, label, classes })),
    )
    expect(boxes.length).toBeGreaterThan(0)
    for (const box of boxes)
      expect(Math.abs(box.width - box.height), `${box.label}: ${box.classes}`).toBeLessThanOrEqual(1)

    const wrappingButtons = await page.locator('button:visible').evaluateAll((nodes) =>
      nodes
        .filter((node) => node.textContent?.trim())
        .map((node) => ({ label: node.textContent?.trim(), whiteSpace: getComputedStyle(node).whiteSpace }))
        .filter(({ whiteSpace }) => whiteSpace !== 'nowrap'),
    )
    expect(wrappingButtons, 'Visible button labels must remain on one line').toEqual([])

    const toolbar = page.locator('[data-editor-toolbar]')
    await toolbar.scrollIntoViewIfNeeded()
    const [commandBox, toolbarBox] = await Promise.all([
      page.locator('[data-editor-command-bar]').boundingBox(),
      toolbar.boundingBox(),
    ])
    expect(commandBox).not.toBeNull()
    expect(toolbarBox).not.toBeNull()
    expect(toolbarBox!.y).toBeGreaterThanOrEqual(commandBox!.y + commandBox!.height - 1)
  })

  test('settings preserve tab state and only show save feedback when dirty', async ({ page }, testInfo) => {
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/settings?tab=branding`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveURL(/tab=branding/)
    await expect(page.getByText(/unsaved|neuložen/i)).toHaveCount(0)
    const description = page.getByLabel(/Description|Popis/i)
    await description.fill(`${await description.inputValue()} updated`)
    await expect(page.getByText(/unsaved|neuložen/i)).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('statistics and tags use accessible dialogs', async ({ page }, testInfo) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop sidebar interaction')
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/admin`)
    await expect(page.locator('main')).toBeVisible()
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    await page
      .locator('button')
      .filter({ hasText: /Blog Statistics|Statistiky blogu/ })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectOverlayWithinViewport(page)
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('admin-statistics-dialog.png', { fullPage: true })
    await page.keyboard.press('Escape')

    await page
      .locator('button')
      .filter({ hasText: /Manage Tags|Spravovat štítky/ })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectOverlayWithinViewport(page)
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('admin-tags-dialog.png', { fullPage: true })
  })

  test('draft workflow and header popovers remain readable', async ({ page }, testInfo) => {
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/drafts`)
    await expect(page.locator('main')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)

    const account = page.getByRole('button', { name: /^admin$/i }).first()
    await account.click()
    await expect(page.getByText(/admin@test\.local/i)).toBeVisible()
    await expectAccessible(page)
    await page.keyboard.press('Escape')
    await expect(account).toBeFocused()

    const notifications = page.getByRole('button', { name: /Open notifications|Otevřít oznámení/i })
    await notifications.click()
    await expect(page.getByText(/No new notifications|Žádné nové notifikace/i)).toBeVisible()
    await expectAccessible(page)
    await page.keyboard.press('Escape')
    await expect(notifications).toBeFocused()
  })

  test('public article keeps the publication shell and shared reading state', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop article geometry')
    await preparePage(page)
    const localhostCookies = (await page.context().cookies()).map((cookie) => ({
      ...cookie,
      domain: 'localhost',
      expires: cookie.expires,
    }))
    await page.context().addCookies(localhostCookies)
    await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    await expect(page.locator('[data-slot="root"][data-collapsed]')).toHaveCount(0)
    const tocLinks = page.locator('aside nav a')
    expect(await tocLinks.count()).toBeGreaterThan(1)
    const secondHeading = tocLinks.nth(1)
    await secondHeading.click()
    await expect(page.locator('aside nav a[aria-current="location"]')).toHaveCount(1)

    const progress = page.locator('[aria-label="Reading progress"] [role="progressbar"]')
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        return Number(await progress.getAttribute('aria-valuenow'))
      })
      .toBeGreaterThanOrEqual(99)
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
  })
})

test.describe('superadmin', () => {
  test.use({ storageState: join(authDir, 'super.json') })

  test('client management', async ({ page }, testInfo) => {
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/master`)
    await expect(page.locator('main')).toBeVisible()
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.getByRole('heading', { name: /Client sites|Klientské weby/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('superadmin-clients.png', { fullPage: true })
  })

  test('client create and global users workflows use constrained overlays', async ({ page }, testInfo) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop sidebar interaction')
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/master`)
    await expect(page.locator('main')).toBeVisible()
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    await page
      .locator('button')
      .filter({ hasText: /Client Management|Správa klientů/ })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('superadmin-create-client-slideover.png', { fullPage: true })
    await page.keyboard.press('Escape')

    await page
      .locator('button')
      .filter({ hasText: /User List|Seznam uživatelů/ })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('superadmin-global-users-dialog.png', { fullPage: true })
  })

  test('client edit and destructive actions use accessible overlays', async ({ page }, testInfo) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop table interaction')
    await preparePage(page)
    await page.goto(`/${localeFor(testInfo.project.name)}/master`)
    await expect(page.locator('main')).toBeVisible()
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

    await page
      .getByRole('button', { name: /Edit|Upravit/i })
      .first()
      .click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('superadmin-edit-client-slideover.png', { fullPage: true })
    await page.keyboard.press('Escape')

    await page
      .getByRole('button', { name: /Delete\/Deactivate|Smazat\/Deaktivovat/i })
      .first()
      .click()
    const confirmation = page.getByRole('dialog')
    await expect(confirmation).toBeVisible()
    await expect(confirmation.getByRole('button', { name: /Permanently delete|Trvale smazat/i })).toBeVisible()
    await expectAccessible(page)
    await expect(page).toHaveScreenshot('superadmin-delete-confirmation.png', { fullPage: true })
  })
})

test.describe('permissions', () => {
  test.use({ storageState: join(authDir, 'reader.json') })

  for (const route of ['/admin', '/drafts', '/settings', '/master']) {
    test(`reader cannot open ${route}`, async ({ page }, testInfo) => {
      await preparePage(page)
      await page.goto(`/${localeFor(testInfo.project.name)}${route}`)
      await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
      await expect(page).not.toHaveURL(new RegExp(`${route.replace('/', '\\/')}(?:[/?]|$)`))
    })
  }
})
