import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { applyProjectColorScheme, expectAccessible, expectNoHorizontalOverflow } from './helpers'

const authDir = join(process.cwd(), 'tests/e2e/.auth')

const row = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `qa-${String(index).padStart(3, '0')}`,
  type: 'FOLLOW',
  message: `Reader ${index} followed you.`,
  isRead: false,
  createdAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  articleId: null,
  article: null,
  link: null,
  ...overrides,
})

test.describe('notification panel', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  test('marks notifications as read, loads more on scroll and navigates from a whole row', async ({
    page,
  }, testInfo) => {
    const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
    const pages: number[] = []
    await page.route('**/api/notifications?*', async (route) => {
      const number = Number(new URL(route.request().url()).searchParams.get('page'))
      pages.push(number)
      const notifications = Array.from({ length: 25 }, (_, index) => {
        const position = (number - 1) * 25 + index
        return position === 0
          ? row(0, {
              type: 'SYSTEM',
              message: 'Your comment was reported.\nThe reason stays on its own line.',
              link: `/${locale}/admin/series`,
            })
          : row(position)
      })
      await route.fulfill({
        json: {
          notifications,
          unreadCount: 3,
          hasMore: number < 3,
          cursor: { createdAt: notifications[0]!.createdAt, id: notifications[0]!.id },
        },
      })
    })

    await page.goto(`/${locale}/admin/series`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await applyProjectColorScheme(page)

    const read = page.waitForResponse(
      (response) => response.url().endsWith('/api/notifications/read') && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: /notifications|oznámení/i }).click()
    // The real endpoint runs against the seeded database, so this covers the access policy too.
    expect((await read).status()).toBe(200)

    const panel = page.getByRole('dialog')
    const list = panel.locator('[data-notification-id="qa-000"]')
    await expect(list).toContainText(/Unread|Nepřečteno/)
    await expect(page.locator('[data-notification-count]')).toHaveCount(0)
    await expect(panel.getByRole('heading', { name: /^(Notifications|Oznámení)$/ })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    // Only the panel: it partly covers page rows, which axe would then report as too small.
    await expectAccessible(page, [], '[role="dialog"]')

    expect(pages.filter((number) => number > 1)).toEqual([])
    await panel.locator('[data-notification-id="qa-024"]').scrollIntoViewIfNeeded()
    await expect.poll(() => pages.includes(2)).toBe(true)
    await expect(panel.locator('[data-notification-id="qa-025"]')).toBeAttached()
    await panel.locator('[data-notification-id="qa-049"]').scrollIntoViewIfNeeded()
    await expect.poll(() => pages.includes(3)).toBe(true)
    await expect(panel.locator('[data-notification-id="qa-050"]')).toBeAttached()

    await list.scrollIntoViewIfNeeded()
    await list.getByRole('link').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
