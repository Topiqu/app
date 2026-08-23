import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { expectAccessible, expectNoHorizontalOverflow, expectOverlayWithinViewport, preparePage } from './helpers'

const authDir = join(process.cwd(), 'tests/e2e/.auth')

const luminance = (rgb: string) => {
  const channels = rgb
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number) ?? [0, 0, 0]
  const linear = channels.map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

test('publication hero and canonical cards remain visible, aligned and contrasting', async ({ page }) => {
  await preparePage(page)
  await page.goto('http://localhost:4173/cs')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()

  const latest = page.locator('[data-primary-cta]')
  await expect(latest).toHaveCount(1)
  await expect(latest).toBeVisible()
  const colors = await latest.evaluate((element) => {
    const style = getComputedStyle(element)
    return { foreground: style.color, background: style.backgroundColor }
  })
  const ratio =
    (Math.max(luminance(colors.foreground), luminance(colors.background)) + 0.05) /
    (Math.min(luminance(colors.foreground), luminance(colors.background)) + 0.05)
  expect(ratio).toBeGreaterThanOrEqual(4.5)

  const cards = page.locator('[data-article-card]')
  expect(await cards.count()).toBeGreaterThan(1)
  for (const card of await cards.all()) {
    const geometry = await card.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const footer = element.querySelector('[data-article-footer]')?.getBoundingClientRect()
      return {
        overflow: element.scrollWidth - element.clientWidth,
        bottomGap: footer ? box.bottom - footer.bottom : 999,
      }
    })
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    expect(geometry.bottomGap).toBeLessThanOrEqual(24)
  }
  await expectNoHorizontalOverflow(page)
  await expectAccessible(page)
})

test('article TOC remains sticky while the active heading changes', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Desktop TOC')
  await preparePage(page)
  await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const toc = page.locator('aside').filter({ has: page.getByRole('navigation', { name: /Obsah|Table of contents/i }) })
  await expect.poll(() => toc.count()).toBe(1)
  await expect(toc).toBeVisible()
  const initialTop = (await toc.boundingBox())!.y
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.55))
  await expect.poll(async () => (await toc.boundingBox())?.y ?? 0).toBeLessThanOrEqual(initialTop + 2)
  await expect(page.locator('aside nav a[aria-current="location"]')).toHaveCount(1)
})

test('article breadcrumbs and sources stay on one line without horizontal overflow', async ({ page }) => {
  await preparePage(page)
  await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
  const breadcrumb = page.getByRole('navigation', { name: /Drobečková navigace|Breadcrumbs/i })
  await expect(breadcrumb).toBeVisible()
  const geometry = await breadcrumb.locator('ol').evaluate((element) => {
    const children = [...element.querySelectorAll(':scope > li')].map((child) => child.getBoundingClientRect())
    return {
      lines: new Set(children.map((box) => Math.round(box.top))).size,
      overflow: element.scrollWidth - element.clientWidth,
    }
  })
  expect(geometry.lines).toBe(1)
  expect(geometry.overflow).toBeLessThanOrEqual(1)

  const sources = page.getByRole('button', { name: /Zdroje|Sources/i })
  if ((await sources.getAttribute('aria-expanded')) !== 'true') {
    await sources.click()
  }
  const sourceList = page
    .locator('ol')
    .filter({ has: page.getByText('w3.org') })
    .first()
  await expect(sourceList).toBeVisible()
  expect(await sourceList.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await expectNoHorizontalOverflow(page)
})

test.describe('authenticated GIF picker', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  test('loads on demand, recovers from an error and returns focus', async ({ page, context }) => {
    let requests = 0
    let categoryAttempts = 0
    const gif = {
      id: 'fixture-gif',
      title: 'Celebration fixture',
      images: {
        fixed_height: { url: '/app-logo.png', width: '200', height: '200' },
        original: { url: '/app-logo.png', width: '512', height: '512' },
      },
    }
    await page.route('**/api/gifs**', async (route) => {
      requests += 1
      const url = new URL(route.request().url())
      if (url.searchParams.get('action') === 'list-categories') {
        categoryAttempts += 1
        if (categoryAttempts === 1) {
          await route.fulfill({ status: 500, json: { message: 'Fixture category failure' } })
          return
        }
        await route.fulfill({ json: { data: [{ name: 'Reactions', name_encoded: 'reactions', gif }] } })
        return
      }
      await route.fulfill({
        json: { data: [gif], pagination: { offset: 0, count: 1, total_count: 1 } },
      })
    })

    await preparePage(page)
    const authCookies = await context.cookies()
    await context.addCookies(authCookies.map(({ domain: _domain, ...cookie }) => ({ ...cookie, domain: 'localhost' })))
    await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
    const trigger = page.getByRole('button', { name: /Add GIF|Přidat GIF/i })
    await expect(trigger).toBeVisible({ timeout: 15_000 })
    expect(requests).toBe(0)

    await trigger.click()
    const retry = page.getByRole('button', { name: /Retry|Zkusit znovu/i })
    await expect(retry).toBeVisible()
    expect(requests).toBe(2)
    if ((page.viewportSize()?.width ?? 0) < 640) {
      const box = await page.locator('[data-gif-picker]').boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1)
    } else {
      await expectOverlayWithinViewport(page)
    }
    await retry.click()
    await expect(page.getByRole('button', { name: 'Celebration fixture' })).toBeVisible()
    await page.getByRole('button', { name: 'Celebration fixture' }).click()
    await expect(trigger).toBeFocused()
    const selectedGif = page.locator('img[alt="GIF"]')
    await selectedGif.scrollIntoViewIfNeeded()
    await expect(selectedGif).toBeVisible()

    await trigger.click()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(1)
  })
})

test.describe('admin stabilization', () => {
  test.use({ storageState: join(authDir, 'admin.json') })

  test('existing article opens by id and can be saved', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'desktop-light-en',
      'The mutating editor flow runs once to avoid cross-project races',
    )
    await preparePage(page)
    await page.goto('/cs/admin/editor/20000000-0000-4000-8000-000000000001')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    const title = page.getByRole('textbox', { name: /Název článku|Article title/i }).first()
    await expect(title).toHaveValue('Jak postavit udržitelnou digitální redakci')
    const original = await title.inputValue()
    await title.fill(`${original} E2E`)
    const commandBar = page.locator('[data-editor-command-bar]')
    await expect(commandBar).toHaveAttribute('data-editor-submitting', 'false')
    await expect(commandBar).toHaveAttribute('data-editor-title-length', String(`${original} E2E`.length))
    const save = page.getByRole('button', { name: /Uložit změny|Save changes/i }).first()
    await expect(save).toBeEnabled()
    const update = page.waitForResponse(
      (response) =>
        response.url().includes('/api/articles/20000000-0000-4000-8000-000000000001') &&
        response.request().method() === 'PATCH',
    )
    await save.click()
    expect((await update).ok()).toBe(true)
    await expect(page).toHaveURL(/\/cs\/admin(?:\?|$)/)

    await page.goto('/cs/admin/editor/20000000-0000-4000-8000-000000000001')
    const restoredTitle = page.getByRole('textbox', { name: /Název článku|Article title/i }).first()
    await expect(restoredTitle).toHaveValue(`${original} E2E`)
    await restoredTitle.fill(original)
    const restore = page.waitForResponse(
      (response) =>
        response.url().includes('/api/articles/20000000-0000-4000-8000-000000000001') &&
        response.request().method() === 'PATCH',
    )
    await page
      .getByRole('button', { name: /Uložit změny|Save changes/i })
      .first()
      .click()
    expect((await restore).ok()).toBe(true)
  })

  test('article filters and sorting persist in the URL', async ({ page }) => {
    await preparePage(page)
    await page.goto('/cs/admin')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    const search = page.getByRole('searchbox', { name: /Hledat články|Search/i }).first()
    await search.fill('obsahový')
    await expect(page.locator('[data-article-table]')).toHaveAttribute('data-search-query', 'obsahový')
    await expect(page).toHaveURL(/query=/)
    await expect(page).toHaveURL(/sort=createdAt/)
    await expectNoHorizontalOverflow(page)
  })

  test('comment composer keeps the native Nuxt UI focus treatment', async ({ page, context }) => {
    await preparePage(page)
    const authCookies = await context.cookies()
    await context.addCookies(authCookies.map(({ domain: _domain, ...cookie }) => ({ ...cookie, domain: 'localhost' })))
    await page.goto('http://localhost:4173/cs/clanky/jak-postavit-udrzitelnou-redakci')
    const composer = page.locator('textarea#comment')
    await composer.focus()
    await expect(composer).toBeFocused()
    const focusStyle = await composer.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        outlineStyle: style.outlineStyle,
      }
    })
    expect(focusStyle.boxShadow !== 'none' || focusStyle.outlineStyle !== 'none').toBe(true)
    expect(focusStyle.borderColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('danger confirmations stay compact and preserve a clear action hierarchy', async ({ page }) => {
    await preparePage(page)
    await page.goto('/cs/settings?tab=branding')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    const tagline = page.getByLabel(/Tagline|Slogan/i)
    const original = await tagline.inputValue()
    await tagline.fill(`${original} test`)
    await page.locator('header a[href="/cs"]').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Všechny provedené změny budou ztraceny|All changes will be lost/i)).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Zrušit|Cancel/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Ano, zavřít|Yes, close/i })).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(480)
    expect(box!.height).toBeLessThanOrEqual(360)
    await expectAccessible(page)

    await dialog.getByRole('button', { name: /Zrušit|Cancel/i }).click()
    await expect(dialog).toHaveCount(0)
    await tagline.fill(original)
  })

  test('brand kit persists and the preview matches the public publication', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-light-en', 'Mutating brand roundtrip runs once')
    await preparePage(page)
    const session = (await (await page.request.get('/api/auth/session')).json()) as { user: { clientSiteId: string } }
    const id = session.user.clientSiteId
    const original = (await (await page.request.get(`/api/clients/${id}`)).json()) as {
      tagline: string | null
      faviconUrl: string | null
      typographyPreset: 'MODERN' | 'EDITORIAL' | 'SYSTEM'
      theme: string
    }

    try {
      const faviconSaved = await page.request.patch(`/api/clients/${id}`, {
        data: { faviconUrl: '/app-logo.png' },
      })
      expect(faviconSaved.ok()).toBe(true)

      for (const [label, font] of [
        ['Modern', 'Manrope'],
        ['Editorial', 'Source Serif'],
        ['System', 'system-ui'],
      ] as const) {
        await page.goto('/en/settings?tab=branding')
        await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
        const tagline = page.getByLabel('Tagline')
        await tagline.fill('Brand kit browser fixture')
        await expect(tagline).toHaveValue('Brand kit browser fixture')
        await expect(page.getByText('25/80')).toBeVisible()
        await page.getByRole('button', { name: new RegExp(label, 'i') }).click()
        const save = page.getByRole('button', { name: 'Save Changes' })
        await expect(save).toBeVisible()
        const update = page.waitForResponse(
          (response) => response.url().includes(`/api/clients/${id}`) && response.request().method() === 'PATCH',
        )
        await save.click()
        expect((await update).ok()).toBe(true)
        const preview = page.locator('[data-publication-preview]:visible')
        const previewTokens = await preview.evaluate((element) => {
          const style = getComputedStyle(element)
          return { font: style.fontFamily, cta: style.getPropertyValue('--topiqu-cta-bg').trim() }
        })

        await page.goto('http://localhost:4173/en')
        await expect(page.getByText('Brand kit browser fixture')).toBeVisible()
        await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/app-logo.png')
        const publicTokens = await page.locator('.publication-surface').evaluate((element) => {
          const style = getComputedStyle(element)
          return { font: style.fontFamily, cta: style.getPropertyValue('--topiqu-cta-bg').trim() }
        })
        expect(publicTokens).toEqual(previewTokens)
        expect(publicTokens.font).toContain(font)
      }
    } finally {
      await page.request.patch(`/api/clients/${id}`, {
        data: {
          tagline: original.tagline,
          faviconUrl: original.faviconUrl,
          typographyPreset: original.typographyPreset,
          theme: original.theme,
        },
      })
    }
  })
})

test.describe('superadmin stabilization', () => {
  test.use({ storageState: join(authDir, 'super.json') })

  test('client filters, sorting and users modal remain viewport-safe', async ({ page }) => {
    await preparePage(page)
    await page.goto('/cs/master')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await page.getByRole('button', { name: /Filtry|Filters/i }).click()
    const domain = page.getByRole('textbox', { name: /Doména|Domain/i }).first()
    await domain.fill('localhost')
    await expect(page).toHaveURL(/domain=localhost/)
    await page.getByRole('combobox', { name: /Řadit podle|Sort by/i }).click()
    await page.getByRole('option', { name: /Název|Name/i }).click()
    await expect(page).toHaveURL(/sort=name/)

    await page
      .getByRole('button', { name: /Uživatelé klienta|Client users/i })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expectOverlayWithinViewport(page)
    await expectNoHorizontalOverflow(page)
    await expectAccessible(page)
  })
})
