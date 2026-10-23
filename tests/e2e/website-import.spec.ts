import { join } from 'node:path'
import { expect, test } from '@playwright/test'

import { emptyWebsiteValues, type WebsiteImportView } from '../../shared/utils/websiteImport'
import {
  applyProjectColorScheme,
  expectAccessible,
  expectNoHorizontalOverflow,
  preparePage,
  waitForPageReady,
} from './helpers'

test.use({ storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json') })

const fixture = (): WebsiteImportView => ({
  id: 'synthetic-onboarding-import',
  sourceUrl: 'https://firma.cz/',
  status: 'READY',
  result: {
    values: {
      ...emptyWebsiteValues(),
      focus: 'Výběrová káva a její domácí příprava.',
      audience: 'Začínající domácí baristé.',
      keywords: ['káva', 'espresso'],
      language: 'cs',
    },
    sources: [{ url: 'https://firma.cz/', title: 'Firma' }],
    warnings: [],
  },
  current: { ...emptyWebsiteValues(), language: 'en' },
  expected: {},
  acceptedFields: [],
  errorCode: null,
  knowledge: [
    { id: 'synthetic-source', title: 'Firma – informace a služby', sourceUrl: 'https://firma.cz/', status: 'PENDING' },
  ],
})

test('reviews onboarding suggestions and submits only the selected edited field', async ({ page }, info) => {
  await preparePage(page)
  const job = fixture()
  let submitted: { fields: string[]; values: { focus: string } } | undefined
  await page.route('**/api/website-import', (route) =>
    route.fulfill({ json: { websiteUrl: job.sourceUrl, import: job } }),
  )
  await page.route('**/api/website-import/*/apply', async (route) => {
    submitted = route.request().postDataJSON()
    job.status = 'REVIEWED'
    await route.fulfill({ json: { acceptedFields: submitted!.fields } })
  })
  const locale = info.project.name.endsWith('-cs') ? 'cs' : 'en'
  await page.goto(`/${locale}/settings?tab=content&websiteImport=${job.id}`)
  const panel = page.locator('[data-website-import-panel]')
  await expect(panel).toBeVisible()
  await applyProjectColorScheme(page)
  await expect(page.locator('[data-website-import-notice]')).toBeVisible()
  await expect(panel.locator('input[autocomplete="url"]')).toHaveCount(0)
  const focus = panel.locator('[data-website-field="focus"]')
  await focus.getByRole('textbox').fill('Praktické návody pro domácí baristy.')
  await focus.getByRole('checkbox').press('Space')
  await expectNoHorizontalOverflow(page)
  await expectAccessible(page)
  await page.screenshot({ path: info.outputPath('website-review.png'), fullPage: true })
  await panel.getByRole('button', { name: /Apply selected|Použít vybrané/ }).click()
  await expect.poll(() => submitted?.fields).toEqual(['focus'])
  expect(submitted!.values.focus).toBe('Praktické návody pro domácí baristy.')
  await expect(page.locator('[data-website-import-notice]')).toHaveCount(0)
  await waitForPageReady(page)
})

test('offers accept-all for an onboarding result', async ({ page }, info) => {
  await preparePage(page)
  let job: WebsiteImportView | null = fixture()
  let selected: string[] = []
  await page.route('**/api/website-import', (route) =>
    route.fulfill({ json: { websiteUrl: 'https://firma.cz/', import: job } }),
  )
  await page.route('**/api/website-import/*/apply', async (route) => {
    selected = route.request().postDataJSON().fields
    job = null
    await route.fulfill({ json: { acceptedFields: selected } })
  })
  const locale = info.project.name.endsWith('-cs') ? 'cs' : 'en'
  await page.goto(`/${locale}/settings?tab=content&websiteImport=synthetic-onboarding-import`)
  const panel = page.locator('[data-website-import-panel]')
  await expect(panel).toBeVisible()
  await applyProjectColorScheme(page)
  await panel.getByRole('button', { name: /All's correct|Vše je správně/ }).click()
  await expect.poll(() => selected).toEqual(['keywords', 'focus', 'audience', 'language', 'knowledge'])
  await expect(panel).toHaveCount(0)
  await expect(page.getByText(/Website suggestions reviewed|Návrhy z webu byly zkontrolovány/).last()).toBeVisible()
  await waitForPageReady(page)
  await expect(page.locator('[data-website-import-panel]')).toHaveCount(0)
  await expect(page.locator('[data-website-import-notice]')).toHaveCount(0)
})

test('does not offer manual imports when no onboarding job exists', async ({ page }, info) => {
  await preparePage(page)
  await page.route('**/api/website-import', (route) =>
    route.fulfill({ json: { websiteUrl: 'https://firma.cz/', import: null } }),
  )
  const locale = info.project.name.endsWith('-cs') ? 'cs' : 'en'
  await page.goto(`/${locale}/settings?tab=content`)
  await waitForPageReady(page)
  await expect(page.locator('[data-website-import-panel]')).toHaveCount(0)
  await expect(page.locator('[data-website-import-notice]')).toHaveCount(0)
})

test('updates the persistent onboarding notice when the background result is ready', async ({ page }, info) => {
  await preparePage(page)
  const job = fixture()
  job.status = 'PROCESSING'
  await page.route('**/api/website-import', (route) =>
    route.fulfill({ json: { websiteUrl: job.sourceUrl, import: job } }),
  )
  const locale = info.project.name.endsWith('-cs') ? 'cs' : 'en'
  await page.goto(`/${locale}/settings?tab=content&websiteImport=${job.id}`)
  const panel = page.locator('[data-website-import-panel]')
  await expect(page.locator('[data-website-import-notice]')).toContainText(/Preparing settings|Připravujeme nastavení/)
  await expect(panel.locator('[data-website-field="focus"]')).toHaveCount(0)
  job.status = 'READY'
  await expect(panel.locator('[data-website-field="focus"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-website-import-notice]')).toContainText(/suggestions are ready|návrhy.*připravené/i)
})
