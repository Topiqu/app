import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

import { createDatabaseClient } from '../../server/utils/database'
import { expectNoHorizontalOverflow, expectOverlayWithinViewport, preparePage, waitForPageReady } from './helpers'

test.use({ storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json') })

test('domain setup exposes provider records and clears private certificate material', async ({ page }) => {
  await preparePage(page, { allowCancelledRequests: true })
  // Billing providers are outside this domain UI scenario and have no local credentials.
  await page.route('**/api/stripe/plans', (route) =>
    route.fulfill({ json: { PRO: { month: null, year: null }, PREMIUM: { month: null, year: null } } }),
  )
  await page.setViewportSize({ width: 320, height: 800 })
  const host = 'publication.example.com'
  await page.route('**/api/domain', (route) =>
    route.fulfill({
      json: {
        domain: 'fixture.topiqu.com',
        canUseCustomDomain: true,
        currentVerification: null,
        pending: {
          domain: host,
          txt: { name: `_topiqu-verification.${host}`, value: 'topiqu-verification=synthetic-challenge' },
          routing: { type: 'CNAME', name: host, value: 'domains.topiqu.com' },
        },
        connections: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            host,
            state: 'CERTIFICATE',
            errorCode: null,
            cleanupRequestedAt: null,
            certificateExpiresAt: null,
            validationRecords: [
              {
                type: 'TXT',
                name: `_acme-challenge.${host}`,
                value: 'synthetic-cloudflare-validation-value'.repeat(3),
              },
            ],
          },
        ],
      },
    }),
  )
  await page.route('**/api/domain/certificate', (route) =>
    route.fulfill({ json: { ready: false, state: 'CERTIFICATE' } }),
  )
  await page.goto('/en/admin')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  // Enter settings through client navigation so the lazy domain query is intercepted in the browser.
  const settings = page.getByRole('link', { name: 'Settings', exact: true }).first()
  if (!(await settings.isVisible())) {
    await page
      .getByRole('button', { name: /Open navigation|Open menu|Toggle sidebar/i })
      .first()
      .click()
  }
  await settings.click()
  const connection = page.getByRole('region', { name: host, exact: true })
  await expect(connection).toBeVisible()
  await expect(connection.getByText('Preparing HTTPS', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await connection.getByRole('button', { name: 'Own origin certificate', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Own origin certificate', exact: true })
  await expect(dialog).toBeVisible()
  await expectOverlayWithinViewport(page)
  await dialog.getByLabel('Certificate chain (PEM)', { exact: true }).fill('synthetic-public-fixture')
  await dialog.getByLabel('Private key (PEM)', { exact: true }).fill('synthetic-private-fixture')
  await dialog.getByRole('button', { name: 'Install certificate', exact: true }).click()
  await expect(dialog).toBeHidden()
  await connection.getByRole('button', { name: 'Own origin certificate', exact: true }).click()
  await expect(dialog.getByLabel('Private key (PEM)', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Certificate chain (PEM)', { exact: true })).toHaveValue('')
  await page.keyboard.press('Escape')
  await waitForPageReady(page)
})

test('a legacy disconnect can be completed without stale adoption errors', async ({ page }) => {
  await preparePage(page, { allowCancelledRequests: true })
  await page.setViewportSize({ width: 320, height: 800 })
  let complete = false
  const id = '00000000-0000-4000-8000-000000000001'
  await page.route('**/api/stripe/plans', (route) =>
    route.fulfill({ json: { PRO: { month: null, year: null }, PREMIUM: { month: null, year: null } } }),
  )
  await page.route('**/api/domain', (route) =>
    route.fulfill({
      json: {
        domain: 'fixture.topiqu.com',
        canUseCustomDomain: true,
        currentVerification: null,
        pending: null,
        connections: complete
          ? []
          : [
              {
                id,
                host: 'old.example.com',
                state: 'DISCONNECTING',
                cleanupRequestedAt: '2026-01-01T00:00:00.000Z',
                certificateExpiresAt: null,
                validationRecords: [],
                errorCode: 'ADOPTION_REQUIRED',
              },
            ],
      },
    }),
  )
  await page.route('**/api/domain/refresh', (route) => {
    complete = true
    return route.fulfill({ json: { ready: false, state: 'DISCONNECTED' } })
  })
  await page.goto('/en/admin')
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const settings = page.getByRole('link', { name: 'Settings', exact: true }).first()
  if (!(await settings.isVisible()))
    await page
      .getByRole('button', { name: /Open navigation|Open menu|Toggle sidebar/i })
      .first()
      .click()
  await settings.click()
  const connection = page.getByRole('region', { name: 'old.example.com', exact: true })
  await expect(connection).toBeVisible()
  await expect(
    connection.getByText('Existing provider configuration needs review by a platform administrator.', { exact: true }),
  ).toHaveCount(0)
  const retry = connection.getByRole('button', { name: 'Complete disconnection', exact: true })
  await expect(retry).toBeEnabled()
  const request = page.waitForRequest((r) => r.url().endsWith('/api/domain/refresh') && r.method() === 'POST')
  await retry.click()
  expect((await request).postDataJSON()).toEqual({ connectionId: id })
  await expect(connection).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('custom domain reservation and cancellation preserve the live address through real API routes', async ({
  request,
  playwright,
}) => {
  const url = new URL(process.env.TEST_DATABASE_URL || '')
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/test/i.test(url.pathname))
    throw new Error('A local disposable test database is required')
  const db = createDatabaseClient(url.href)
  const host = `domain-${randomUUID()}.example.test`
  const site = await db.clientSite.findUniqueOrThrow({
    where: { name: 'topiqu-dev' },
    select: {
      id: true,
      domain: true,
      plan: true,
      pendingDomain: true,
      domainVerified: true,
      domainVerificationStatus: true,
      domainVerificationToken: true,
      domainVerificationIssuedAt: true,
      domainVerificationError: true,
      domainRoutingVerified: true,
      domainVerificationFailures: true,
      domainVerificationDegradedAt: true,
    },
  })
  expect(site.pendingDomain).toBeNull()
  try {
    await db.clientSite.update({ where: { id: site.id }, data: { plan: 'PRO' } })
    const anonymous = await playwright.request.newContext({
      baseURL: 'http://127.0.0.1:4173',
      storageState: { cookies: [], origins: [] },
    })
    try {
      expect((await anonymous.post('/api/domain/pending', { data: { domain: host } })).status()).toBe(401)
    } finally {
      await anonymous.dispose()
    }
    const reserved = await request.post('/api/domain/pending', { data: { domain: host } })
    expect(reserved.status()).toBe(200)
    const status = await request.get('/api/domain')
    expect(status.status()).toBe(200)
    const state = await status.json()
    expect(state.domain).toBe(site.domain)
    expect(state.pending.domain).toBe(host)
    const connection = state.connections.find((entry: { host: string }) => entry.host === host)
    expect(connection).toMatchObject({ host, state: 'OWNERSHIP' })
    for (const key of ['probeSecret', 'encryptedCertificate', 'challenge', 'cloudflareId', 'dokployId', 'leaseId'])
      expect(connection).not.toHaveProperty(key)
    expect((await request.delete('/api/domain/pending')).status()).toBe(200)
    const cancelled = await db.domainConnection.findUniqueOrThrow({ where: { host } })
    expect(cancelled.state).toBe('DISCONNECTED')
    expect(cancelled.cleanupRequestedAt).not.toBeNull()
    expect(
      await db.clientSite.findUnique({ where: { id: site.id }, select: { domain: true, pendingDomain: true } }),
    ).toEqual({ domain: site.domain, pendingDomain: null })
    const reconnected = await request.post('/api/domain/pending', { data: { domain: host } })
    expect(reconnected.status()).toBe(200)
    expect((await reconnected.json()).pending.txt.value).not.toBe(state.pending.txt.value)
    expect((await request.delete('/api/domain/pending')).status()).toBe(200)
    // Reproduce a legacy manual domain whose provisioning stopped at ADOPTION_REQUIRED.
    await db.clientSite.update({ where: { id: site.id }, data: { domain: host } })
    await db.domainConnection.update({
      where: { host },
      data: {
        state: 'OWNERSHIP',
        cleanupRequestedAt: null,
        errorCode: 'ADOPTION_REQUIRED',
      },
    })
    const fallback = `fixture-${randomUUID()}.topiqu.com`
    const disconnected = await request.post('/api/domain/disconnect', { data: { fallback } })
    expect(disconnected.status()).toBe(200)
    expect(await disconnected.json()).toMatchObject({ domain: fallback })
    expect(
      await db.domainConnection.findUniqueOrThrow({ where: { host }, select: { state: true, errorCode: true } }),
    ).toEqual({ state: 'DISCONNECTED', errorCode: null })
    expect((await request.post('/api/domain/pending', { data: { domain: host } })).status()).toBe(200)
    expect((await request.delete('/api/domain/pending')).status()).toBe(200)
  } finally {
    await db.clientSite.updateMany({
      where: { id: site.id, pendingDomain: host },
      data: { pendingDomain: null, pendingDomainToken: null, pendingDomainRequestedAt: null },
    })
    await db.domainConnection.deleteMany({
      where: { clientSiteId: site.id, host, cloudflareId: null, dokployId: null, certificateId: null },
    })
    const { id, pendingDomain, ...restore } = site
    await db.clientSite.update({ where: { id }, data: restore })
    await db.$disconnect()
  }
})
