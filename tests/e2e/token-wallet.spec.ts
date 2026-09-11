import { join } from 'node:path'
import { test, expect } from '@playwright/test'

import { expectNoHorizontalOverflow } from './helpers'
const localeFor = (project: string) => (project.endsWith('-cs') ? 'cs' : 'en')

test.use({ storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json') })
test('wallet has no capacity meter and paginated activity stays scrollable', async ({ page }, testInfo) => {
  await page.route('**/api/clients/*/log?*', async (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') || 1)
    await route.fulfill({
      json: {
        items: Array.from({ length: 4 }, (_, i) => ({
          id: `${pageNumber}-${i}`,
          action: 'CRON_ARTICLE_PUBLISHED',
          createdAt: new Date().toISOString(),
          metadata: { title: `Long article title ${pageNumber}-${i} `.repeat(8) },
        })),
        hasMore: pageNumber < 5,
      },
    })
  })
  await page.goto(`/${localeFor(testInfo.project.name)}/admin`)
  await page.locator('[data-client-version-bar] button').first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('progressbar')).toHaveCount(0)
  const activity = dialog.getByRole('region').filter({ has: page.locator('ol') })
  await expect(activity.locator('li')).toHaveCount(4)
  for (let i = 2; i <= 5; i++) {
    await dialog
      .getByRole('button', { name: /Next|Další/ })
      .last()
      .click()
    await expect(activity.locator('li')).toHaveCount(i * 4)
  }
  const geometry = await activity.evaluate((el) => ({
    height: el.clientHeight,
    content: el.scrollHeight,
    overflow: getComputedStyle(el).overflowY,
  }))
  expect(geometry.content).toBeGreaterThan(geometry.height)
  expect(geometry.overflow).toBe('auto')
  await activity.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  expect(await activity.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await expectNoHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})
