import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { expectOverlayWithinViewport, preparePage } from './helpers'

test.use({ storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json') })

const expectNoHorizontalOverflow = async (page: import('@playwright/test').Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test('publication and admin UX plan remains viewport-safe', async ({ page, context }) => {
  await preparePage(page)
  const authCookies = await context.cookies()
  await context.addCookies(authCookies.map(({ domain: _domain, ...cookie }) => ({ ...cookie, domain: 'localhost' })))

  await page.goto('http://localhost:4173/cs/clanky/pristupny-clanek-od-prvniho-nadpisu')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const inlineFallback = page.locator('.article-inline-image-fallback')
  await expect(inlineFallback).toContainText('Schéma přístupného článku')
  await inlineFallback.scrollIntoViewIfNeeded()
  await expect(page.locator('.topiqu-dashboard-group')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page.goto('/cs/admin/editor/jak-postavit-udrzitelnou-redakci?lang=en')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await expect(page.getByRole('tab', { name: 'en', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: /Přeložit teď|Translate now/i })).toBeVisible()

  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(page.locator('aside [data-article-settings-panel]')).toBeVisible()
  } else {
    await page.getByRole('button', { name: /Nastavení|Settings/i }).click()
    await expect(page.locator('[role="dialog"] [data-article-settings-panel]')).toBeVisible()
    await page.keyboard.press('Escape')
  }
  await expectNoHorizontalOverflow(page)

  await page.goto('/cs/admin')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const filtersButton = page.getByRole('button', { name: /Filtry|Filters/i })
  await filtersButton.click()
  await expect(filtersButton).toHaveAttribute('aria-expanded', 'true')
  const toolbar = page.locator('[data-article-table-toolbar]')
  await expect(toolbar).toBeVisible()
  await expect(toolbar.getByLabel(/Stav|Status/i)).toBeVisible()
  await expectNoHorizontalOverflow(page)

  const statisticsButton = page.getByRole('button', { name: /Statistiky|Statistics/i })
  if (!(await statisticsButton.isVisible())) {
    await page.getByRole('button', { name: /Otevřít navigaci|Open navigation/i }).click()
  }
  await statisticsButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectOverlayWithinViewport(page)
  await expectNoHorizontalOverflow(page)
})
