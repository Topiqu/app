import { join } from 'node:path'
import { homedir } from 'node:os'
import { defineConfig, devices } from '@playwright/test'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const useCompiledServer = process.env.PLAYWRIGHT_USE_BUILD === '1'
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required. Browser tests never run against a development or production database.',
  )
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must be different from DATABASE_URL.')
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-US',
    timezoneId: 'Europe/Prague',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01 } },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'mobile-light-en',
      testIgnore: [/auth\.setup\.ts/, /wide-qa\.spec\.ts/],
      dependencies: ['setup'],
      use: { ...devices['iPhone 13'], viewport: { width: 360, height: 800 }, colorScheme: 'light', locale: 'en-US' },
    },
    {
      name: 'tablet-dark-cs',
      testIgnore: [/auth\.setup\.ts/, /wide-qa\.spec\.ts/],
      dependencies: ['setup'],
      use: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 }, colorScheme: 'dark', locale: 'cs-CZ' },
    },
    {
      name: 'desktop-light-en',
      testIgnore: [/auth\.setup\.ts/, /wide-qa\.spec\.ts/],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light',
        locale: 'en-US',
      },
    },
    {
      name: 'desktop-dark-cs',
      testIgnore: [/auth\.setup\.ts/, /wide-qa\.spec\.ts/],
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'dark',
        locale: 'cs-CZ',
      },
    },
    {
      name: 'wide-qa',
      testMatch: /wide-qa\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
        locale: 'cs-CZ',
      },
    },
  ],
  webServer: {
    command: useCompiledServer
      ? `${join(homedir(), '.bun/bin/bun')} .output/server/index.mjs`
      : `${join(homedir(), '.bun/bin/bun')} run dev --host 127.0.0.1 --port 4173`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_DATABASE_URL: testDatabaseUrl,
      AUTH_ORIGIN: 'http://127.0.0.1:4173/api/auth',
      AUTH_SECRET: process.env.AUTH_SECRET || 'topiqu-browser-test-secret',
      HOST: '127.0.0.1',
      PORT: '4173',
    },
    timeout: 120_000,
  },
})
