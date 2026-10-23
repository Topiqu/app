import type { APIResponse, Page, Request, Route } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { preparePage, waitForPageReady } from './helpers'

const articleId = '20000000-0000-4000-8000-000000000001'
const articleTitle = 'Jak postavit udržitelnou digitální redakci'
const editorPath = `/cs/admin/editor/${articleId}`
const adminEmail = 'admin@test.local'
const readerEmail = 'reader@test.local'
const aborted = /ERR_ABORTED|cancelled|canceled|NS_BINDING_ABORTED/i

const sessionIdentity = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch('/api/auth/get-session')
    const session = (await response.json()) as { user?: { id?: string; email?: string } } | null
    return { status: response.status, id: session?.user?.id ?? null, email: session?.user?.email ?? null }
  })

const signIn = async (page: Page, email: string) => {
  await page.goto('/en/auth')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test1234')
  const signedIn = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/sign-in/credentials' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Log In', exact: true }).last().click()
  expect((await signedIn).ok()).toBe(true)
  // Credentials finish before the form's session refresh and redirect. Synchronize
  // outside the document so a real navigation cannot destroy this identity read.
  await expect
    .poll(async () => {
      const response = await page.request.get('/api/auth/get-session')
      const session = (await response.json()) as { user?: { email?: string } } | null
      return session?.user?.email ?? null
    })
    .toBe(email)
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toMatch(
      email === adminEmail
        ? /^\/(?:en|cs|de|fr)\/admin\/?$/
        : /^\/(?:en|cs|de|fr)\/(?:user|uzivatel|benutzer|utilisateur)\/?$/,
    )
}

// localhost is the seeded publication; 127.0.0.1 is the platform host. Keep
// logout's public landing and the private pages on the same real tenant origin.
test.use({ baseURL: 'http://localhost:4173', trace: 'off', screenshot: 'off', video: 'off' })
test.skip(process.env.PLAYWRIGHT_USE_BUILD !== '1', 'This lifecycle contract requires the compiled service worker')

test.describe('account switching and offline privacy', () => {
  // Own sessions: logging out here must not revoke the shared setup fixture used by other tests.
  // Routing would disable the browser HTTP cache, so this case never intercepts a response.
  test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'allow' })

  test('logout and another real account never expose the previous private responses offline', async ({
    page,
    context,
    baseURL,
  }) => {
    await preparePage(page, { allowCancelledRequests: true, fixedTime: false })
    let pageErrors = 0
    page.on('pageerror', () => pageErrors++)
    try {
      await signIn(page, adminEmail)
      await page.goto('/en/user')
      await expect(page.getByText(adminEmail, { exact: true }).first()).toBeVisible()
      await waitForPageReady(page)
      await expect
        .poll(() =>
          page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? null),
        )
        .toMatch(/\/sw\.js$/)
      await page.reload()
      await waitForPageReady(page)
      await expect
        .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
        .toMatch(/\/sw\.js$/)

      const first = await sessionIdentity(page)
      expect(first).toMatchObject({ status: 200, email: adminEmail })
      expect(typeof first.id).toBe('string')
      const firstAccount = `/api/users/${first.id}/account`
      const privateAccount = await page.evaluate(async (path) => {
        const response = await fetch(path)
        const account = (await response.json()) as { email?: string }
        return { status: response.status, email: account.email, cacheControl: response.headers.get('cache-control') }
      }, firstAccount)
      expect(privateAccount).toMatchObject({ status: 200, email: adminEmail })
      expect(privateAccount.cacheControl).toContain('no-store')

      const documentBeforeLogout = await page.evaluate(() => performance.timeOrigin)
      await page
        .getByRole('button', { name: /^admin$/i })
        .first()
        .click()
      const signedOut = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/auth/sign-out' && response.request().method() === 'POST',
      )
      await page
        .getByRole('button', { name: /^(Log out|Odhlásit se)$/i })
        .last()
        .click()
      expect((await signedOut).ok()).toBe(true)
      // Session clearing can first redirect the current SPA document. Wait for
      // the actual replacement, retrying across destroyed execution contexts.
      const signedOutDocument = await page.waitForFunction(
        (previous) => performance.timeOrigin !== previous,
        documentBeforeLogout,
        { timeout: 5_000 },
      )
      await signedOutDocument.dispose()
      await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/(?:en|cs|de|fr)\/?$/)
      await waitForPageReady(page)
      expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(documentBeforeLogout)
      expect((await sessionIdentity(page)).id).toBeNull()
      await expect(page.getByText(adminEmail, { exact: true })).toHaveCount(0)

      await signIn(page, readerEmail)
      await page.goto('/en/user')
      await expect(page.getByText(readerEmail, { exact: true }).first()).toBeVisible()
      await expect(page.getByText(adminEmail, { exact: true })).toHaveCount(0)
      await waitForPageReady(page)
      const second = await sessionIdentity(page)
      expect(second).toMatchObject({ status: 200, email: readerEmail })
      expect(second.id).not.toBe(first.id)
      expect((await page.request.get(firstAccount)).status()).toBe(403)

      const privateEntries = await page.evaluate(async () => {
        const paths: string[] = []
        for (const name of await caches.keys()) {
          const cache = await caches.open(name)
          for (const request of await cache.keys()) {
            const path = new URL(request.url).pathname
            if (
              /^\/api\/|^\/(?:en|cs|de|fr)\/(?:user|uzivatel|benutzer|utilisateur|admin|master|settings|drafts)(?:\/|$)/.test(
                path,
              )
            )
              paths.push(path)
          }
        }
        return paths
      })
      expect(privateEntries, 'The compiled worker must never persist private documents or API responses').toEqual([])

      await context.setOffline(true)
      const offline = await page.evaluate(
        async ({ paths, previousEmail }) =>
          Promise.all(
            paths.map(async (path) => {
              try {
                const response = await fetch(path)
                return {
                  path,
                  networkOnly: false,
                  containsPreviousAccount: (await response.text()).includes(previousEmail),
                }
              } catch {
                return { path, networkOnly: true, containsPreviousAccount: false }
              }
            }),
          ),
        {
          paths: ['/api/auth/get-session', firstAccount, `/api/users/${second.id}/account`, '/en/user'],
          previousEmail: adminEmail,
        },
      )
      expect(offline.every((response) => response.networkOnly)).toBe(true)
      expect(offline.some((response) => response.containsPreviousAccount)).toBe(false)
      await expect(page.getByText(adminEmail, { exact: true })).toHaveCount(0)
      await expect(page.getByText(readerEmail, { exact: true }).first()).toBeVisible()
      expect(pageErrors).toBe(0)
    } finally {
      await context.setOffline(false)
      await page.request.post('/api/auth/sign-out', { headers: { Origin: baseURL! }, data: {} }).catch(() => {})
    }
  })
})

test.describe('interrupted compiled navigation', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json', serviceWorkers: 'block' })

  test.beforeEach(async ({ context }) => {
    // Same synthetic localhost fixture mapping as resource-lifecycle.spec.ts.
    await context.addCookies((await context.cookies()).map((cookie) => ({ ...cookie, domain: 'localhost' })))
  })

  test('a real media read is canceled when its modal and editor unmount during SPA navigation', async ({ page }) => {
    await preparePage(page, { allowCancelledRequests: true, fixedTime: false })
    await page.goto(editorPath)
    await expect(page.locator('.tiptap.ProseMirror')).toBeVisible()
    const documentBefore = await page.evaluate(() => performance.timeOrigin)
    let release!: () => void
    let finished!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const complete = new Promise<void>((resolve) => (finished = resolve))
    let realStatus = 0
    let readError: unknown
    let canceledReads = 0
    const recordCancellation = (request: Request) => {
      if (new URL(request.url()).pathname === '/api/media' && aborted.test(request.failure()?.errorText ?? ''))
        canceledReads++
    }
    const intercept = async (route: Route) => {
      let response: APIResponse | undefined
      try {
        response = await route.fetch()
        realStatus = response.status()
        await gate
        // Delivery is delayed; the payload and status come unchanged from the real server.
        await route.fulfill({ response }).catch(() => {})
      } catch (error) {
        readError = error
      } finally {
        try {
          await response?.dispose()
        } finally {
          finished()
        }
      }
    }
    page.on('requestfailed', recordCancellation)
    await page.route('**/api/media?**', intercept, { times: 1 })
    try {
      const mobileSettings = (page.viewportSize()?.width ?? 0) < 1280
      if (mobileSettings) await page.getByRole('button', { name: /^(Article settings|Nastavení článku)$/ }).click()
      await page
        .locator('[data-article-settings-panel]:visible')
        .getByRole('button', { name: /^(Choose from library|Vybrat z knihovny)$/ })
        .click()
      const media = page.getByRole('dialog', { name: /^(Choose from library|Vybrat z knihovny)$/ })
      await expect(media).toBeVisible()
      await expect.poll(() => realStatus).toBe(200)
      await page.keyboard.press('Escape')
      await expect(media).toBeHidden()
      if (mobileSettings) await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page
        .locator('[data-editor-command-bar]')
        .getByRole('button', { name: /^(Back|Zpět)$/ })
        .click()
      await expect(page).toHaveURL((url) => url.pathname === '/cs/admin')
      await expect(page.locator('.tiptap.ProseMirror')).toHaveCount(0)
      await expect.poll(() => canceledReads).toBeGreaterThan(0)
      release()
      await complete
      // Restore normal browser fetching before the destination's lazy images settle.
      await page.unroute('**/api/media?**', intercept)
      expect(readError).toBeUndefined()
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentBefore)
      await waitForPageReady(page)
    } finally {
      release()
      await page.unroute('**/api/media?**', intercept)
      page.off('requestfailed', recordCancellation)
    }
  })

  test('leaving a real SSR editor before hydration does not corrupt the next authenticated page', async ({ page }) => {
    await preparePage(page, { allowCancelledRequests: true, fixedTime: false })
    let holdInitial = true
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const heldScripts = new Set<string>()
    const transfers: Promise<void>[] = []
    let releasedScripts = 0
    const intercept = (route: Route) => {
      if (!holdInitial || route.request().resourceType() !== 'script') return route.continue()
      heldScripts.add(route.request().url())
      const transfer = gate.then(async () => {
        // The old document can already have abandoned this intercepted request.
        // Such a request need not produce Chromium's network requestfailed event.
        await route.continue().catch(() => {})
        releasedScripts++
      })
      transfers.push(transfer)
      return transfer
    }
    await page.route('**/_nuxt/*.js', intercept)
    try {
      const initial = await page.goto(editorPath, { waitUntil: 'commit' })
      expect(initial?.status()).toBe(200)
      // toHaveURL(predicate) waits for load; this case deliberately blocks that
      // event with the initial scripts. Assert the committed route independently.
      await expect.poll(() => new URL(page.url()).pathname).toBe(editorPath)
      await expect(page.getByPlaceholder(/^(Article title|Název článku)$/)).toHaveValue(articleTitle)
      await expect.poll(() => heldScripts.size).toBeGreaterThan(0)
      await expect(page.locator('html[data-topiqu-hydrated="true"]')).toHaveCount(0)
      holdInitial = false
      await page.goto('/en/user', { waitUntil: 'commit' })
      release()
      await Promise.all(transfers)
      expect(releasedScripts).toBe(transfers.length)
      await page.unroute('**/_nuxt/*.js', intercept)
      await expect(page.getByText(adminEmail, { exact: true }).first()).toBeVisible()
      await expect(page.locator('.tiptap.ProseMirror')).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect((await sessionIdentity(page)).email).toBe(adminEmail)
      await waitForPageReady(page)
    } finally {
      holdInitial = false
      release()
      await Promise.allSettled(transfers)
      await page.unroute('**/_nuxt/*.js', intercept)
      heldScripts.clear()
      transfers.length = 0
    }
  })
})
