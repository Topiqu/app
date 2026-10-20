import { expect, test } from '@playwright/test'

import { preparePage } from './helpers'

test.use({ storageState: 'tests/e2e/.auth/admin.json' })

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
