import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { createDatabaseClient } from '../../server/utils/database'

test.use({
  storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json'),
  launchOptions: {
    args: [
      '--host-resolver-rules=MAP *.auth-transfer.test 127.0.0.1, MAP *.topiqu.com 127.0.0.1, MAP topiqu.com 127.0.0.1',
      '--no-proxy-server',
    ],
  },
})

test('guests share interface preferences across Topiqu hosts', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, colorScheme: 'light' })
  try {
    const page = await context.newPage()
    await page.goto('http://app.topiqu.com:4173/en/auth')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await page.getByRole('button', { name: 'Toggle color mode', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Interface language', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Čeština', exact: true }).click()
    await expect(page).toHaveURL(/\/cs\/autorizace/)
    const cookies = await context.cookies('http://app.topiqu.com:4173')
    for (const name of ['topiqu-language', 'topiqu-theme']) {
      expect(cookies.find((cookie) => cookie.name === name)?.domain).toBe('.topiqu.com')
    }
    await page.goto('http://topiqu.com:4173/')
    await expect(page).toHaveURL(/\/cs(?:\/|$)/)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.locator('html')).toHaveClass(/dark/)
  } finally {
    await context.close()
  }
})

test('custom domains support credentials, SSR sessions and a browser-bound Topiqu handoff', async ({
  page,
  playwright,
  browser,
}) => {
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL)
  const host = 'blog.auth-transfer.test'
  const origin = `http://${host}:4173`
  const site = await db.clientSite.findUniqueOrThrow({
    where: { name: 'topiqu-dev' },
    select: { id: true, domain: true, domainVerified: true, plan: true },
  })
  const account = await db.user.findUniqueOrThrow({
    where: { email: 'admin@test.local' },
    select: { id: true, language: true, theme: true },
  })
  try {
    await db.clientSite.update({ where: { id: site.id }, data: { domain: host, domainVerified: true, plan: 'PRO' } })
    await page.goto(`${origin}/en/auth`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await page.getByLabel('Email').fill('admin@test.local')
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test1234')
    const signedIn = page.waitForResponse((r) => r.url().includes('/api/auth/sign-in/credentials'))
    await page.getByRole('button', { name: 'Log In', exact: true }).last().click()
    expect((await signedIn).ok()).toBe(true)
    await expect
      .poll(async () => page.evaluate(async () => (await (await fetch('/api/auth/get-session')).json())?.user?.role))
      .toBe('admin')
    await page.reload()
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    expect(await page.evaluate(async () => (await (await fetch('/api/auth/get-session')).json())?.user?.role)).toBe(
      'admin',
    )
    const customCookie = (await page.context().cookies(origin)).find((c) => c.name.endsWith('session_token'))!
    expect(customCookie.httpOnly).toBe(true)
    expect(customCookie.domain).toBe(host)
    // Integration consent is confirmed centrally without losing the requesting tenant host.
    await page.goto(`${origin}/en/settings?tab=integrations`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    expect(new URL(page.url()).origin).toBe(origin)
    await page
      .locator('[data-slot="body"]')
      .filter({ has: page.getByText('LinkedIn', { exact: true }) })
      .getByRole('button', { name: 'Open settings', exact: true })
      .click()
    await page.getByRole('button', { name: 'Connect Personal', exact: true }).click()
    await page.waitForURL(/127\.0\.0\.1:4173\/en\/integrations-connect\?request=/)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.getByText(new RegExp(`LinkedIn.*${host.replaceAll('.', '\\.')}`))).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.waitForURL((current) => current.origin === origin && current.pathname === '/en/settings')
    expect(new URL(page.url()).searchParams.get('linkedin')).toBe('cancelled')
    const preferences = await page.evaluate(async () => {
      const session = await (await fetch('/api/auth/get-session')).json()
      const saved = await fetch(`/api/users/${session.user.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: 'cs', theme: 'dark' }),
      })
      return { status: saved.status, user: await saved.json() }
    })
    expect(preferences.status).toBe(200)
    expect(preferences.user).toMatchObject({ language: 'cs', theme: 'dark' })
    await page.goto(`${origin}/en/auth`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.locator('html')).toHaveClass(/dark/)
    expect(new URL(page.url()).pathname).toMatch(/^\/en\//)
    await page.goto(origin)
    await expect(page).toHaveURL(/\/cs(?:\/|$)/)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.locator('html')).toHaveClass(/dark/)
    // Another origin reads the persisted account preference without sharing the customer's cookie.
    const platformPreferences = await page.request.get('http://127.0.0.1:4173/api/auth/get-session')
    expect((await platformPreferences.json()).user).toMatchObject({ language: 'cs', theme: 'dark' })
    const preferenceCookie = (await page.context().cookies(origin)).find((c) => c.name === 'topiqu-theme')!
    expect(preferenceCookie.domain).toBe(host)
    const isolated = await playwright.request.newContext({
      extraHTTPHeaders: { cookie: `${customCookie.name}=${customCookie.value}` },
    })
    try {
      const replay = await isolated.get('http://127.0.0.1:4173/api/auth/get-session')
      expect((await replay.json())?.user).toBeUndefined()
    } finally {
      await isolated.dispose()
    }

    await page.evaluate(() =>
      fetch('/api/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
    )
    await page.goto(`${origin}/en/auth`)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await page.getByRole('button', { name: 'Continue with Topiqu', exact: true }).click()
    await page.waitForURL(/127\.0\.0\.1:4173\/en\/auth-transfer\?request=/)
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await expect(page.getByText(`You are connecting to ${host}:4173.`, { exact: true })).toBeVisible()
    const authorization = page.waitForResponse((r) => r.url().endsWith('/api/auth/transfer/authorize'))
    const completion = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/auth/transfer/complete')
    await page.getByRole('button', { name: /^Continue as / }).click()
    const authorized = await authorization
    expect(authorized.ok()).toBe(true)
    const url = (await completion).url()
    await page.waitForURL((current) => current.origin === origin && !current.pathname.includes('/api/auth/transfer'))
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    expect(await page.evaluate(async () => (await (await fetch('/api/auth/get-session')).json())?.user?.role)).toBe(
      'admin',
    )
    const replayStatus = await page.evaluate(
      async (target) => (await fetch(target, { redirect: 'manual' })).status,
      url,
    )
    expect(replayStatus).toBe(403)
    await page.reload()
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    expect(await page.evaluate(async () => (await (await fetch('/api/auth/get-session')).json())?.user?.role)).toBe(
      'admin',
    )
    const cold = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    try {
      const visitor = await cold.newPage()
      await visitor.goto(`${origin}/en/auth`)
      await visitor.locator('html[data-topiqu-hydrated="true"]').waitFor()
      await visitor.getByRole('button', { name: 'Continue with Topiqu', exact: true }).click()
      await visitor.waitForURL(/127\.0\.0\.1:4173\/en\/auth-transfer\?request=/)
      await visitor.locator('html[data-topiqu-hydrated="true"]').waitFor()
      await visitor.getByLabel('Email').fill('reader@test.local')
      await visitor.getByRole('textbox', { name: 'Password', exact: true }).fill('test1234')
      await visitor.getByRole('button', { name: 'Log In', exact: true }).last().click()
      await visitor.getByRole('button', { name: /^(Continue as|Pokračovat jako) / }).click()
      await visitor.waitForURL(
        (current) => current.origin === origin && !current.pathname.includes('/api/auth/transfer'),
      )
      await visitor.locator('html[data-topiqu-hydrated="true"]').waitFor()
      expect(
        await visitor.evaluate(async () => (await (await fetch('/api/auth/get-session')).json())?.user?.role),
      ).toBe('reader')
    } finally {
      await cold.close()
    }
  } finally {
    await db.user.update({ where: { id: account.id }, data: { language: account.language, theme: account.theme } })
    await db.clientSite.update({
      where: { id: site.id },
      data: { domain: site.domain, domainVerified: site.domainVerified, plan: site.plan },
    })
    await db.$disconnect()
  }
})
