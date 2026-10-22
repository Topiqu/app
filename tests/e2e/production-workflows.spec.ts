import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

import { applyProjectColorScheme, expectAccessible, expectNoHorizontalOverflow } from './helpers'

const authDir = join(process.cwd(), 'tests/e2e/.auth')
const origin = 'http://127.0.0.1:4173'

test.describe('article recovery', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  test('keeps a conflicting draft and loads history without publishing or changing the URL', async ({
    page,
  }, testInfo) => {
    const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
    const originalTitle = 'Původní článek pro obnovu'
    const slug = `revision-check-${randomUUID()}`
    const tags: { id: string; name: string }[] = []
    for (const label of ['Original', 'Updated']) {
      const tag = await page.request.post('/api/tags', {
        data: { name: `${label} ${slug}`, slug: `${label.toLowerCase()}-${slug}` },
      })
      expect(tag.ok()).toBe(true)
      tags.push(await tag.json())
    }
    const [originalTag, nextTag] = tags
    const created = await page.request.post('/api/articles', {
      data: {
        title: originalTitle,
        slug,
        content: '<p>Původní obsah.</p>',
        status: 'draft',
        language: 'cs',
        tags: [originalTag!.id],
      },
    })
    expect(created.ok()).toBe(true)
    const { id } = await created.json()
    try {
      await page.goto(`/${locale}/admin/editor/${slug}`)
      await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
      await applyProjectColorScheme(page)
      const title = page.getByPlaceholder(/^(Article title|Název článku)$/)
      await expect(title).toHaveAccessibleName(locale === 'cs' ? 'Název článku' : 'Article title')
      await expect(page.getByPlaceholder(/^(article-address|adresa-clanku)$/)).toHaveAccessibleName('URL')
      await expect(title).toHaveValue(originalTitle)
      const latest = await page.request.get(`/api/articles/${id}`)
      const { editVersion } = await latest.json()
      const changed = await page.request.patch(`/api/articles/${id}`, {
        data: { title: 'Updated in another session', expectedVersion: editVersion, tagIds: [nextTag!.id] },
      })
      expect(changed.ok()).toBe(true)
      await title.fill('My unsaved draft')
      const save = page.getByRole('button', { name: /^(Save changes|Uložit změny)$/ })
      const conflict = page.waitForResponse(
        (response) => response.url().endsWith(`/api/articles/${id}`) && response.request().method() === 'PATCH',
      )
      await save.click()
      expect((await conflict).status()).toBe(409)
      await expect(title).toHaveValue('My unsaved draft')
      await expect(
        page.getByText(/This article has changed in another session|Článek se změnil v jiném přihlášení/),
      ).toBeVisible()
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: /Download my draft|Stáhnout moje úpravy/ }).click()
      expect((await download).suggestedFilename()).toBe('my-unsaved-draft-draft.json')
      await page.getByRole('button', { name: /Load latest version|Načíst aktuální verzi/ }).click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /Load latest version|Načíst aktuální verzi/ })
        .click()
      await expect(title).toHaveValue('Updated in another session')
      await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
      const mobileSettings = (page.viewportSize()?.width ?? 0) < 1280
      const settingsButton = page.getByRole('button', { name: /^(Article settings|Nastavení článku)$/ })
      if (mobileSettings) await settingsButton.click()
      const settings = page.locator('[data-article-settings-panel]:visible')
      await expect(settings.getByText(nextTag!.name, { exact: true }).first()).toBeVisible()
      if (mobileSettings) {
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      await page.getByRole('button', { name: /Version history|Historie verzí/, exact: true }).click()
      const history = page.getByRole('dialog')
      await expect(history.getByText(originalTitle, { exact: true })).toBeVisible()
      await expectNoHorizontalOverflow(page)
      await expectAccessible(page)
      await history
        .getByRole('button', { name: /Load into editor|Načíst do editoru/ })
        .first()
        .click()
      await expect(title).toHaveValue(originalTitle)
      if (mobileSettings) await settingsButton.click()
      await expect(settings.getByText(originalTag!.name, { exact: true }).first()).toBeVisible()
      await expect(settings.getByText(nextTag!.name, { exact: true })).toHaveCount(0)
      if (mobileSettings) {
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      expect((await (await page.request.get(`/api/articles/${id}`)).json()).title).toBe('Updated in another session')
      const saved = page.waitForResponse(
        (response) => response.url().endsWith(`/api/articles/${id}`) && response.request().method() === 'PATCH',
      )
      await save.click()
      expect((await saved).ok()).toBe(true)
      const restored = await (await page.request.get(`/api/articles/${id}`)).json()
      expect(restored).toMatchObject({ title: originalTitle, slug, status: 'draft', editVersion: editVersion + 2 })
      expect(restored.tags.map((entry: { tag: { id: string } }) => entry.tag.id)).toEqual([originalTag!.id])
    } finally {
      await page.request.delete(`/api/articles/${id}`)
      for (const tag of tags) await page.request.delete(`/api/tags/${tag.id}`)
    }
  })
})

test.describe('session controls', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  test('revokes another browser session while preserving this one', async ({ page, browser }, testInfo) => {
    const other = await browser.newContext({ baseURL: origin })
    try {
      const signedIn = await other.request.post('/api/auth/sign-in/credentials', {
        headers: { Origin: origin },
        data: { email: 'admin@test.local', password: 'test1234' },
      })
      expect(signedIn.ok()).toBe(true)
      expect((await (await other.request.get('/api/auth/get-session')).json()).user).toBeTruthy()
      const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
      await page.goto(`/${locale}/${locale === 'cs' ? 'uzivatel' : 'user'}`)
      await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
      await applyProjectColorScheme(page)
      await page.getByRole('button', { name: /^(Security|Zabezpečení)$/ }).click()
      const section = page.locator('#sessions-section')
      const revoke = section.getByRole('button', { name: /Revoke other sessions|Odhlásit ostatní relace/ })
      await expect(revoke).toBeVisible()
      await expect(section.getByText(/127\.0\.0\.1:4173/).first()).toBeVisible()
      await revoke.click()
      const confirmation = page.getByRole('dialog')
      await confirmation.getByRole('button', { name: /Revoke other sessions|Odhlásit ostatní relace/ }).click()
      await expect(revoke).toHaveCount(0)
      expect((await (await page.request.get('/api/auth/get-session')).json()).user).toBeTruthy()
      expect((await (await other.request.get('/api/auth/get-session')).json())?.user).toBeFalsy()
    } finally {
      await other.close()
    }
  })
})

test.describe('operations', () => {
  test.use({ storageState: join(authDir, 'super.json') })
  test('shows safe task and queue status with an accessible refresh', async ({ page }, testInfo) => {
    const locale = testInfo.project.name.endsWith('-cs') ? 'cs' : 'en'
    await page.goto(`/${locale}/master/operations`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await applyProjectColorScheme(page)
    await expect(page.getByRole('heading', { name: /Operations overview|Provozní přehled/ })).toBeVisible()
    await page.getByRole('button', { name: /Refresh status|Obnovit stav/ }).click()
    await expect(page.getByText(/Redis is not configured|Redis není nakonfigurovaný/)).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
  })
})
