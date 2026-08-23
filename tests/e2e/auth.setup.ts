import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test as setup } from '@playwright/test'

setup.describe.configure({ mode: 'serial' })
setup.setTimeout(120_000)

const authDir = join(process.cwd(), 'tests/e2e/.auth')
const password = 'test1234'

for (const role of ['reader', 'admin', 'super'] as const) {
  setup(`authenticate ${role}`, async ({ page }) => {
    page.on('pageerror', (error) => console.error(`[auth browser] ${error.message}`))
    page.on('requestfailed', (request) =>
      console.error(`[auth request] ${request.url()} ${request.failure()?.errorText ?? 'failed'}`),
    )
    const statePath = join(authDir, `${role}.json`)
    await mkdir(dirname(statePath), { recursive: true })
    await page.addInitScript(() => localStorage.removeItem('topiqu-color-mode'))
    await page.goto('/en/auth')
    await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
    await page.getByLabel('Email').fill(`${role}@test.local`)
    const passwordInput = page.getByRole('textbox', { name: 'Password', exact: true })
    await passwordInput.fill(password)
    await passwordInput.blur()
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => candidate.url().includes('/api/auth/callback/credentials')),
      page.getByRole('button', { name: 'Log In', exact: true }).last().click(),
    ])
    if (!response.ok()) throw new Error(`Credentials callback failed with ${response.status()}.`)
    const session = await page.request.get('/api/auth/session')
    const sessionBody = (await session.json()) as { user?: { role?: string } }
    if (!sessionBody.user) throw new Error('Credentials callback did not establish a session.')
    await page.context().storageState({ path: statePath })
  })
}
