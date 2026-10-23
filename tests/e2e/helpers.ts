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

export const preparePage = async (
  page: Page,
  options: { expectedErrorPage?: boolean; allowCancelledRequests?: boolean; fixedTime?: boolean } = {},
) => {
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
    const hydrationDetails = async () => {
      const details = await Promise.all(
        message.args().map(async (argument) => {
          try {
            const value = await argument.jsonValue()
            return typeof value === 'string' ? value : JSON.stringify(value)
          } catch {
            return argument.toString()
          }
        }),
      )
      return details.filter(Boolean).join(' ') || message.text()
    }
    if (isHydrationError && message.type() === 'warning') {
      failures.hydration.push(await hydrationDetails())
      return
    }
    if (message.type() === 'error') {
      // The response listener below records the URL and status. Chromium's
      // duplicate console message has neither, so retaining it only obscures the
      // actionable response failure (and cannot distinguish designed media fallbacks).
      if (/^Failed to load resource: the server responded with a status of \d+/i.test(message.text())) return
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
        failures.hydration.push(await hydrationDetails())
      } else {
        failures.console.push(message.text())
      }
    }
  })
  page.on('requestfailed', (request) => {
    // Route changes can intentionally cancel an in-flight useFetch request.
    if (
      options.allowCancelledRequests &&
      /^(?:net::ERR_ABORTED|cancelled|canceled|NS_BINDING_ABORTED)$/.test(request.failure()?.errorText ?? '')
    )
      return
    if (request.url().startsWith(page.url().split('/').slice(0, 3).join('/'))) {
      failures.requests.push(`${request.url()} ${request.failure()?.errorText ?? 'failed'}`)
    }
  })
  page.on('response', (response) => {
    const origin = page.url().split('/').slice(0, 3).join('/')
    const isExpected404Document =
      failures.expectedErrorPage && response.request().resourceType() === 'document' && response.status() === 404
    const isExpectedMediaFallback =
      response.request().resourceType() === 'image' && [403, 404].includes(response.status())
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
  if (options.fixedTime !== false) await page.clock.setFixedTime(new Date('2026-08-13T12:00:00Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addStyleTag({ content: 'nuxt-devtools-frame, #nuxt-devtools-container { display: none !important; }' })
}

export const waitForPageReady = async (page: Page) => {
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    // Signed-in publications scroll inside the dashboard. Visit that viewport so
    // visible hydration and lazy-media fallbacks actually run before checking them.
    const dashboard = document.querySelector<HTMLElement>('.topiqu-dashboard-scroll')
    const viewportStep = Math.max((dashboard?.clientHeight ?? window.innerHeight) * 0.8, 320)
    const scrollTo = (top: number) =>
      dashboard ? dashboard.scrollTo({ top, behavior: 'instant' }) : window.scrollTo({ top, behavior: 'instant' })
    for (let y = 0; y < (dashboard?.scrollHeight ?? document.documentElement.scrollHeight); y += viewportStep) {
      scrollTo(y)
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
    scrollTo(0)
  })
  const loadingMedia = page.locator('[data-media-state="loading"]:visible')
  try {
    await expect
      .poll(
        async () => {
          // Hidden responsive variants should stay lazy. SPA data can mount
          // rendered images after scrolling, so activate late arrivals as well.
          await page.locator('img[loading="lazy"]:visible').evaluateAll((images) => {
            for (const image of images) (image as HTMLImageElement).loading = 'eager'
          })
          return loadingMedia.count()
        },
        { timeout: 10_000 },
      )
      .toBe(0)
  } catch (error) {
    const pendingMedia = await loadingMedia.evaluateAll((nodes) =>
      nodes.map((node) => {
        const image = node.querySelector('img')
        return { src: image?.currentSrc || image?.src, complete: image?.complete, naturalWidth: image?.naturalWidth }
      }),
    )
    throw new Error(`Media did not settle: ${JSON.stringify(pendingMedia)}`, { cause: error })
  }
  const failures = runtimeFailures.get(page)
  const runtimeErrors = failures
    ? [
        ...failures.hydration.map((message) => `hydration: ${message}`),
        ...failures.page.map((message) => `page: ${message}`),
        ...failures.console.map((message) => `console: ${message}`),
        ...failures.requests.map((message) => `request: ${message}`),
        ...failures.responses.map((message) => `response: ${message}`),
      ]
    : []
  expect(runtimeErrors, 'Page must hydrate and run without browser or first-party request errors').toEqual([])
  if (!failures?.expectedErrorPage) {
    await expect(page.locator('nuxt-error-overlay, #nuxt-error-overlay')).toHaveCount(0)
  }
}

export const applyProjectColorScheme = async (page: Page) => {
  await page.locator('html[data-topiqu-hydrated="true"]').waitFor()
  const dark = await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const root = page.locator('html')
  // A saved account preference overrides the browser scheme. Select the matrix's
  // intended theme through the real control before asserting dark/light accessibility.
  if ((await root.evaluate((node) => node.classList.contains('dark'))) !== dark)
    await page.locator('[data-color-mode]').click()
  if (dark) await expect(root).toHaveClass(/\bdark\b/)
  else await expect(root).not.toHaveClass(/\bdark\b/)
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
