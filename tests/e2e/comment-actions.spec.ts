import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { applyProjectColorScheme, expectNoHorizontalOverflow, expectOverlayWithinViewport } from './helpers'

test.use({ storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json') })

test('comment ellipsis and report form fit long names and nested replies', async ({ page, context }) => {
  const session = (await (await page.request.get('/api/auth/get-session')).json()) as { user: { clientSiteId: string } }
  const cookies = await context.cookies()
  await context.addCookies(cookies.map(({ domain: _domain, ...cookie }) => ({ ...cookie, domain: 'localhost' })))
  const node = (id: string, parentId: string | null, depth: number) => ({
    id,
    parentId,
    depth,
    content: 'Komentář pro kontrolu rozložení',
    userId: 'qa-comment-author',
    articleId: 'qa-article',
    user: { username: 'DlouhéJménoAutoraBezMezer'.repeat(5), isBanned: false },
    article: { clientSiteId: session.user.clientSiteId },
    createdAt: new Date(0).toISOString(),
    deletedAt: null,
    gifUrl: null,
    likes: 0,
    dislikes: 0,
    userReaction: null,
    emojiReactions: [],
    publicationLikes: 0,
    replies: [] as unknown[],
  })
  const root = node('qa-root', null, 1)
  const reply = node('qa-reply', root.id, 2)
  reply.replies.push(node('qa-nested', reply.id, 3))
  root.replies.push(reply)
  await page.route('**/api/comments/*', (route) =>
    route.fulfill({ json: { comments: [root], hasMore: false, total: 3 } }),
  )
  let report: unknown
  await page.route('**/api/notifications', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    report = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true } })
  })
  // Client navigation makes the comment read pass through the isolated browser fixture above.
  await page.goto('http://localhost:4173/cs')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await applyProjectColorScheme(page)
  await page.locator('a[href="/cs/clanky/jak-postavit-udrzitelnou-redakci"]').first().click()
  await expect(page.locator('#comment-qa-nested')).toBeVisible()
  for (const width of [320, 360, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await expectNoHorizontalOverflow(page)
    for (const id of ['qa-root', 'qa-reply', 'qa-nested']) {
      const card = page.locator(`#comment-${id}`)
      const buttons = card.locator('header').first().getByRole('button')
      await expect(buttons).toHaveCount(2)
      const bounds = await card.boundingBox()
      for (const button of await buttons.all()) {
        const box = await button.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(bounds!.x)
        expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
      }
      const replyBox = (await buttons.nth(0).boundingBox())!
      const menuBox = (await buttons.nth(1).boundingBox())!
      expect(replyBox.x + replyBox.width).toBeLessThanOrEqual(menuBox.x)
      const authorBox = (await card.locator('header').first().getByRole('link').boundingBox())!
      expect(authorBox.x + authorBox.width <= replyBox.x || authorBox.y + authorBox.height <= replyBox.y).toBe(true)
    }
  }
  await page.setViewportSize({ width: 320, height: 800 })
  await page
    .locator('#comment-qa-nested')
    .getByRole('button', { name: /Více|More/ })
    .press('Enter')
  await page.getByRole('menuitem', { name: /Nahlásit komentář|Report comment/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const reason = dialog.getByRole('textbox', { name: /Důvod nahlášení|Report reason/i })
  await expect(reason).toBeFocused()
  await expectOverlayWithinViewport(page)
  await reason.fill('Spam mimo téma')
  await dialog.getByRole('button', { name: /Nahlásit komentář|Report comment/i }).click()
  await expect.poll(() => report).toEqual({ commentId: 'qa-nested', reason: 'Spam mimo téma' })
})
