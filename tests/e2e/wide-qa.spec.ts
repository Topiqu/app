import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { expectAccessible, expectNoHorizontalOverflow, preparePage } from './helpers'

const authDir = join(process.cwd(), 'tests/e2e/.auth')

test('1920px public layouts remain readable with missing media and long Czech content', async ({ page }) => {
  await preparePage(page)
  for (const route of ['/cs', '/cs/clanky/jak-postavit-udrzitelnou-redakci', '/cs/autor/admin']) {
    await page.goto(`http://localhost:4173${route}`)
    await expect(page.locator('main')).toBeVisible()
    if (route === '/cs') {
      const ranked = page.locator('[data-article-layout="responsive-row"]').first()
      await expect(ranked).toBeVisible()
      const geometry = await ranked.evaluate((card) => {
        const media = card.querySelector('[data-media-state]')?.getBoundingClientRect()
        const title = card.querySelector('h2')?.getBoundingClientRect()
        return { mediaRight: media?.right ?? 0, titleLeft: title?.left ?? 0, width: card.getBoundingClientRect().width }
      })
      expect(geometry.width).toBeGreaterThan(576)
      expect(geometry.mediaRight).toBeLessThanOrEqual(geometry.titleLeft + 1)
    }
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
    await expect(page).toHaveScreenshot(`wide-public-${route.replaceAll('/', '-') || 'home'}.png`, { fullPage: true })
  }
})

test.describe('authenticated 1920px layouts', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  test('admin editor and settings have no sticky collisions or overflow', async ({ page }) => {
    await preparePage(page)
    for (const route of ['/cs/admin/editor/new', '/cs/settings?tab=branding']) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectAccessible(page)
      await expect(page).toHaveScreenshot(`wide-auth-${route.replaceAll('/', '-')}.png`, { fullPage: true })
    }
  })
})
