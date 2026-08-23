import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

type RuntimeFailures = {
  console: string[]
  hydration: string[]
  page: string[]
  requests: string[]
  responses: string[]
  expectedErrorPage: boolean
}

const runtimeFailures = new WeakMap<Page, RuntimeFailures>()

export const preparePage = async (page: Page, options: { expectedErrorPage?: boolean } = {}) => {
  const failures: RuntimeFailures = {
    console: [],
    hydration: [],
    page: [],
    requests: [],
    responses: [],
    expectedErrorPage: options.expectedErrorPage ?? false,
  }
  runtimeFailures.set(page, failures)
  if (failures.expectedErrorPage) {
    await page.addInitScript(() => {
      const hideDevErrorInspector = () => {
        for (const overlay of document.querySelectorAll<HTMLElement>('nuxt-error-overlay, #nuxt-error-overlay')) {
          overlay.style.setProperty('display', 'none', 'important')
        }
      }
      new MutationObserver(hideDevErrorInspector).observe(document, { childList: true, subtree: true })
    })
  }
  page.on('pageerror', (error) => failures.page.push(error.message))
  page.on('console', async (message) => {
    const isHydrationError =
      /Hydration .*mismatch|Hydration completed but contains mismatches|Hydration (?:text|node) mismatch/i.test(
        message.text(),
      )
    if (isHydrationError && message.type() === 'warning') {
      failures.hydration.push(message.text())
      return
    }
    if (message.type() === 'error') {
      if (/^Failed to load resource: the server responded with a status of 404/i.test(message.text())) return
      if (
        failures.expectedErrorPage &&
        /^Framing '' violates the following Content Security Policy directive:/i.test(message.text())
      )
        return
      // Nuxt's development error inspector probes a data: iframe on intentional
      // error pages. The production app never emits this console message.
      if (
        failures.expectedErrorPage &&
        /^Refused to load data:text\/html;base64,[\s\S]*frame-src directive/i.test(message.text())
      )
        return
      if (isHydrationError) {
        failures.hydration.push(message.text())
      } else {
        failures.console.push(message.text())
      }
      const details = isHydrationError
        ? await Promise.all(
            message.args().map(async (argument) => {
              try {
                return JSON.stringify(await argument.jsonValue())
              } catch {
                return argument.toString()
              }
            }),
          )
        : []
      if (details.length) failures.console.push(details.join(' '))
    }
  })
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(page.url().split('/').slice(0, 3).join('/'))) {
      failures.requests.push(`${request.url()} ${request.failure()?.errorText ?? 'failed'}`)
    }
  })
  page.on('response', (response) => {
    const origin = page.url().split('/').slice(0, 3).join('/')
    const isExpected404Document =
      failures.expectedErrorPage && response.request().resourceType() === 'document' && response.status() === 404
    const isExpectedMediaFallback = response.request().resourceType() === 'image' && response.status() === 404
    if (
      origin &&
      response.url().startsWith(origin) &&
      response.status() >= 400 &&
      !isExpected404Document &&
      !isExpectedMediaFallback
    ) {
      failures.responses.push(`${response.status()} ${response.url()}`)
    }
  })
  await page.clock.setFixedTime(new Date('2026-08-13T12:00:00Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addStyleTag({ content: 'nuxt-devtools-frame, #nuxt-devtools-container { display: none !important; }' })
}

export const waitForPageReady = async (page: Page) => {
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) image.loading = 'eager'
    const viewportStep = Math.max(window.innerHeight * 0.8, 320)
    for (let y = 0; y < document.documentElement.scrollHeight; y += viewportStep) {
      window.scrollTo(0, y)
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
    window.scrollTo(0, 0)
  })
  try {
    await expect.poll(() => page.locator('[data-media-state="loading"]').count(), { timeout: 10_000 }).toBe(0)
  } catch (error) {
    const pendingMedia = await page.locator('[data-media-state="loading"]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const image = node.querySelector('img')
        return { src: image?.currentSrc || image?.src, complete: image?.complete, naturalWidth: image?.naturalWidth }
      }),
    )
    throw new Error(`Media did not settle: ${JSON.stringify(pendingMedia)}`, { cause: error })
  }
  const failures = runtimeFailures.get(page)
  expect(failures?.hydration ?? [], 'Page must hydrate without structural or text mismatches').toEqual([])
  expect(failures?.page ?? [], 'Page must not emit page errors').toEqual([])
  expect(failures?.console ?? [], 'Page must not emit unexpected console errors').toEqual([])
  expect(failures?.requests ?? [], 'First-party requests must not fail').toEqual([])
  expect(failures?.responses ?? [], 'First-party requests must not return server errors').toEqual([])
  if (!failures?.expectedErrorPage) {
    await expect(page.locator('nuxt-error-overlay, #nuxt-error-overlay')).toHaveCount(0)
  }
}

export const expectAccessible = async (page: Page, disabledRules: string[] = []) => {
  await waitForPageReady(page)
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('nuxt-devtools-frame')
    .exclude('nuxt-error-overlay')
    // Reka UI's document-level focus guards are intentionally focusable but
    // visually hidden; axe otherwise reports them as aria-hidden-focus.
    .exclude('span[aria-hidden="true"][tabindex="0"]')
  if (disabledRules.length) builder = builder.disableRules(disabledRules)
  const results = await builder.analyze()
  expect(results.violations, results.violations.map(({ id, help }) => `${id}: ${help}`).join('\n')).toEqual([])
}

export const expectOverlayWithinViewport = async (page: Page) => {
  const overlay = page.getByRole('dialog').last()
  const box = await overlay.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
}

export const expectNoHorizontalOverflow = async (page: Page) => {
  await waitForPageReady(page)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
