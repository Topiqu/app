import type { CDPSession, Page, Request, Route } from '@playwright/test'

import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

import { preparePage, waitForPageReady } from './helpers'

// Run only against the operator-provided compiled test server:
// PLAYWRIGHT_RESOURCE_PROTOCOL=1 PLAYWRIGHT_USE_BUILD=1 bun x --no-install playwright test \
//   tests/e2e/resource-lifecycle.spec.ts --project=desktop-light-en --workers=1 --retries=0
// PLAYWRIGHT_RESOURCE_CYCLES=3 is a smoke run, never the full 100-cycle protocol.
const warmupCycles = 10
const baselineSamples = 5
const checkpointEvery = 10
const prototypeGroup = 'topiqu-resource-prototype'
const queryGroup = 'topiqu-resource-editor-query'
const articlePath = '/cs/clanky/jak-postavit-udrzitelnou-redakci'
const articleTitle = 'Jak postavit udržitelnou digitální redakci'

interface BrowserResources {
  activeUrls: Set<string>
  createdUrls: number
  revokedUrls: number
  rejections: number
}
type ResourceWindow = Window & { __topiquResourceProtocol: BrowserResources }
type Metric = 'heapBytes' | 'nodes' | 'listeners' | 'documents' | 'detachedNodes' | 'editors'
interface Sample {
  cycle: number
  heapBytes: number
  nodes: number
  listeners: number
  documents: number
  detachedNodes: number | null
  editors: number
  liveEditors: number
  activeObjectUrls: number
  createdObjectUrls: number
  revokedObjectUrls: number
  rejections: number
}
interface Growth {
  metric: Metric
  baselineMedian: number
  baselineRange: number
  allowedDrift: number
  tailMedian: number
  medianSlopePerCycle: number
  sustainedGrowth: boolean
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

// Declare the screening policy before measurements. Relative floors tolerate small browser/cache
// variation; 3× the observed warm-up range prevents baseline noise from looking like a trend.
// A drift must also have a positive median pairwise slope exceeding that budget over the run.
const growthFor = (metric: Metric, baseline: Sample[], samples: Sample[], cycles: number): Growth | null => {
  const initial = baseline.map((sample) => sample[metric]).filter((value): value is number => value !== null)
  const measured = samples.filter((sample) => sample[metric] !== null)
  if (initial.length !== baseline.length || !measured.length) return null
  const center = median(initial)
  const range = Math.max(...initial) - Math.min(...initial)
  const floor = metric === 'heapBytes' ? center * 0.05 : metric === 'documents' ? 1 : metric === 'editors' ? 0 : 8
  const allowedDrift = Math.max(range * 3, floor)
  const points = [
    { cycle: 0, value: center },
    ...measured.map((sample) => ({ cycle: sample.cycle, value: sample[metric]! })),
  ]
  const slopes = points.flatMap((point, index) =>
    points.slice(index + 1).map((next) => (next.value - point.value) / (next.cycle - point.cycle)),
  )
  const slope = median(slopes)
  const tail = median(measured.slice(-3).map((sample) => sample[metric]!))
  return {
    metric,
    baselineMedian: center,
    baselineRange: range,
    allowedDrift,
    tailMedian: tail,
    medianSlopePerCycle: slope,
    sustainedGrowth: tail - center > allowedDrift && slope * cycles > allowedDrift,
  }
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            requestIdleCallback(() => resolve(), { timeout: 500 })
          }),
        )
      }),
  )

const sampleResources = async (page: Page, cdp: CDPSession, prototypeId: string, cycle: number): Promise<Sample> => {
  await expect(page.locator('.tiptap.ProseMirror')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await settle(page)
  await cdp.send('HeapProfiler.collectGarbage')
  await cdp.send('HeapProfiler.collectGarbage')
  const { usedSize } = await cdp.send('Runtime.getHeapUsage')
  const counters = await cdp.send('Memory.getDOMCounters')
  let detachedNodes: number | null = null
  await cdp.send('DOM.enable')
  try {
    const detached = await cdp.send('DOM.getDetachedDomNodes')
    detachedNodes = detached.detachedNodes.reduce((count, entry) => count + entry.retainedNodeIds.length, 0)
  } catch (error) {
    if (!/wasn.t found|not found|unsupported|not implemented|-32601/i.test(String(error))) throw error
  } finally {
    // DOM inspection can keep backend node IDs alive. Never let those references span samples.
    await cdp.send('DOM.disable')
  }
  let editorCounts: { total: number; live: number }
  try {
    const { objects } = await cdp.send('Runtime.queryObjects', {
      prototypeObjectId: prototypeId,
      objectGroup: queryGroup,
    })
    const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
      objectId: objects.objectId,
      functionDeclaration:
        'function () { return { total: this.length, live: this.filter(editor => !editor.isDestroyed).length } }',
      returnByValue: true,
    })
    if (exceptionDetails || !result.value) throw new Error('Could not count Tiptap instances')
    editorCounts = result.value
  } finally {
    // The query result is an array of strong references; release it before another GC/checkpoint.
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: queryGroup })
  }
  const resources = await page.evaluate(() => {
    const state = (window as ResourceWindow).__topiquResourceProtocol
    return {
      activeObjectUrls: state.activeUrls.size,
      createdObjectUrls: state.createdUrls,
      revokedObjectUrls: state.revokedUrls,
      rejections: state.rejections,
    }
  })
  expect(editorCounts.live, 'No editor may remain live after leaving the editor route').toBe(0)
  expect(resources.activeObjectUrls, 'Canceled local previews must release their object URLs').toBe(0)
  expect(resources.rejections, 'No unhandled promise rejection may occur').toBe(0)
  return {
    cycle,
    heapBytes: usedSize,
    nodes: counters.nodes,
    listeners: counters.jsEventListeners,
    documents: counters.documents,
    detachedNodes,
    editors: editorCounts.total,
    liveEditors: editorCounts.live,
    ...resources,
  }
}

test.use({
  storageState: join(process.cwd(), 'tests/e2e/.auth/admin.json'),
  trace: 'off',
  screenshot: 'off',
  video: 'off',
})

test.describe('opt-in browser resource screening', () => {
  test.skip(process.env.PLAYWRIGHT_RESOURCE_PROTOCOL !== '1', 'Explicit resource protocol opt-in required')

  test('screens repeated public/editor/modal/preview cleanup for sustained retention', async ({
    page,
    context,
    browserName,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-light-en' || browserName !== 'chromium',
      'Comparable Chromium desktop protocol',
    )
    test.setTimeout(20 * 60_000)
    expect(process.env.PLAYWRIGHT_USE_BUILD, 'A compiled test server must be supplied').toBe('1')
    const origin = new URL(baseURL!)
    expect(['127.0.0.1', 'localhost', '[::1]']).toContain(origin.hostname)
    expect(origin.protocol).toBe('http:')
    const cycles = Number(process.env.PLAYWRIGHT_RESOURCE_CYCLES ?? 100)
    expect(Number.isInteger(cycles) && cycles > 0 && cycles <= 100, 'Use 1–100 measured cycles').toBe(true)
    origin.hostname = 'localhost'
    // Same synthetic admin/localhost fixture mapping as authenticated-flows.spec.ts.
    await context.addCookies((await context.cookies()).map((cookie) => ({ ...cookie, domain: 'localhost' })))

    const report = {
      protocolVersion: 1,
      status: 'incomplete',
      workload: [
        'seeded-public-article',
        'editor-mount-unmount',
        'media-modal',
        'history-modal',
        'avatar-preview-cancel',
      ],
      cyclesRequested: cycles,
      cyclesCompleted: 0,
      fullProtocol: cycles === 100,
      warmupCycles,
      checkpointEvery,
      browserVersion: '',
      clock: 'native',
      fileSelection: 'native-chooser-dom-file-transfer',
      documentReloads: 0,
      delayedReads: 0,
      canceledReads: 0,
      forbiddenMutations: 0,
      pageErrors: 0,
      consoleErrors: 0,
      hydrationWarnings: 0,
      stage: 'setup',
      baseline: [] as Sample[],
      samples: [] as Sample[],
      growth: [] as Growth[],
      failureDiagnostics: undefined as
        | {
            pathname: string
            pendingCount: number
            pendingFirstPartyRequests: { method: string; pathname: string; ageMs: number }[]
          }
        | undefined,
      limitations: [
        'Post-change warmed baseline; no historical before measurement.',
        'Forced-GC Chromium screening, not proof that no leak exists.',
        'Synthetic File/DataTransfer assignment after the native chooser avoids Playwright 1.64.1 internal handle retention.',
        'No raw heap snapshots/retainer paths, native/GPU/server memory, logout/tenant switch or initial-hydration interruption coverage.',
      ],
    }
    const pendingRequests = new Map<Request, { method: string; pathname: string; startedAt: number }>()
    const trackRequest = (request: Request) => {
      const url = new URL(request.url())
      if (url.origin === origin.origin)
        pendingRequests.set(request, {
          method: request.method(),
          pathname: url.pathname,
          startedAt: Date.now(),
        })
    }
    const finishRequest = (request: Request) => {
      pendingRequests.delete(request)
    }
    page.on('pageerror', () => report.pageErrors++)
    page.on('console', (message) => {
      if (/Hydration.*mismatch|Hydration completed but contains mismatches/i.test(message.text()))
        report.hydrationWarnings++
      else if (message.type() === 'error' && !/^Failed to load resource: the server responded/.test(message.text()))
        report.consoleErrors++
    })
    page.on('requestfailed', (request) => {
      if (
        new URL(request.url()).pathname === '/api/media' &&
        /ERR_ABORTED|cancelled|canceled/i.test(request.failure()?.errorText ?? '')
      )
        report.canceledReads++
    })
    await context.route('**/api/**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (
        ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) ||
        (request.method() === 'POST' && path === '/api/media/rights-check') ||
        (request.method() === 'DELETE' && path === '/api/consent/analytics') ||
        path === '/api/sessions/ping' ||
        /^\/api\/articles\/[^/]+\/view$/.test(path)
      )
        return route.continue()
      report.forbiddenMutations++
      await route.abort('blockedbyclient')
    })
    await page.addInitScript(() => {
      const state: BrowserResources = { activeUrls: new Set(), createdUrls: 0, revokedUrls: 0, rejections: 0 }
      ;(window as ResourceWindow).__topiquResourceProtocol = state
      const create = URL.createObjectURL
      const revoke = URL.revokeObjectURL
      URL.createObjectURL = function (blob) {
        const url = create.call(this, blob)
        state.activeUrls.add(url)
        state.createdUrls++
        return url
      }
      URL.revokeObjectURL = function (url) {
        state.activeUrls.delete(url)
        state.revokedUrls++
        return revoke.call(this, url)
      }
      window.addEventListener('unhandledrejection', () => state.rejections++)
    })
    // Playwright's clock stores scheduling Error stacks on pending timers, retaining
    // old Vue setup contexts. Real time avoids measuring that harness-owned retention.
    await preparePage(page, { allowCancelledRequests: true, fixedTime: false })
    const cdp = await context.newCDPSession(page)
    let prototypeId = ''
    try {
      page.on('request', trackRequest)
      page.on('requestfinished', finishRequest)
      page.on('requestfailed', finishRequest)
      report.browserVersion = (await cdp.send('Browser.getVersion')).product
      await page.goto(new URL(articlePath, origin).href)
      await waitForPageReady(page)
      await page.getByRole('button', { name: /^(Reject optional|Odmítnout volitelné)$/ }).click()
      const timeOrigin = await page.evaluate(() => performance.timeOrigin)
      const previewBase64 = await page.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        canvas.getContext('2d')!.fillRect(0, 0, 64, 64)
        return canvas.toDataURL('image/png').split(',')[1]!
      })
      const preview = {
        name: 'synthetic-resource-preview.png',
        mimeType: 'image/png',
        base64: previewBase64,
      }
      const cycle = async (number: number) => {
        report.stage = 'editor'
        await page
          .getByRole('link', { name: /^(Edit|Upravit)$/ })
          .first()
          .click()
        await expect(page.locator('.tiptap.ProseMirror')).toBeVisible()
        if (!prototypeId) {
          // Tiptap explicitly exposes the instance as DOM.editor for tests. Hold only its shared
          // prototype, never an editor/element, so the measuring code cannot retain instances.
          const { result } = await cdp.send('Runtime.evaluate', {
            expression: 'Object.getPrototypeOf(document.querySelector(".tiptap.ProseMirror").editor)',
            objectGroup: prototypeGroup,
          })
          if (!result.objectId) throw new Error('Tiptap prototype was not available')
          prototypeId = result.objectId
        }
        report.stage = 'media'
        const media = page.getByRole('dialog', { name: /^(Choose from library|Vybrat z knihovny)$/ })
        const pattern = '**/api/media?**'
        let received = false
        let release!: () => void
        let finished!: () => void
        const gate = new Promise<void>((resolve) => {
          release = resolve
        })
        const complete = new Promise<void>((resolve) => {
          finished = resolve
        })
        const delayed = number % checkpointEvery === 0
        const intercept = async (route: Route) => {
          received = true
          report.delayedReads++
          try {
            await gate
            // Only this interrupted read uses an empty synthetic response; ordinary cycles hit the API.
            await route.fulfill({ json: { items: [], page: 1, pageSize: 30, total: 0 } }).catch(() => {})
          } finally {
            finished()
          }
        }
        if (delayed) await page.route(pattern, intercept, { times: 1 })
        try {
          await page
            .locator('[data-article-settings-panel]:visible')
            .getByRole('button', { name: /^(Choose from library|Vybrat z knihovny)$/ })
            .click()
          await expect(media).toBeVisible()
          if (delayed) await expect.poll(() => received, { timeout: 10_000 }).toBe(true)
          await page.keyboard.press('Escape')
          await expect(media).toBeHidden()
          report.stage = 'history'
          await page.getByRole('button', { name: /^(Version history|Historie verzí)$/ }).click()
          const history = page.getByRole('dialog', { name: /^(Version history|Historie verzí)$/ })
          await expect(history).toBeVisible()
          await page.keyboard.press('Escape')
          await expect(history).toBeHidden()
          await page.goBack()
          await expect(page.getByRole('heading', { name: articleTitle, exact: true })).toBeVisible()
        } finally {
          release()
          if (received) await complete
          if (delayed) await page.unroute(pattern, intercept)
        }
        report.stage = 'preview'
        await page
          .getByRole('button', { name: /^admin$/i })
          .first()
          .click()
        await page.getByRole('link', { name: /^(View Profile|Zobrazit profil)$/ }).click()
        await page
          .getByRole('button', { name: /^(Upload Avatar|Nahrát avatar)$/ })
          .first()
          .click()
        const avatar = page.getByRole('dialog', { name: /^(Upload Avatar|Nahrát avatar)$/ })
        await expect(avatar).toBeVisible()
        const chooser = page.waitForEvent('filechooser')
        await avatar.getByRole('button', { name: /^(Choose a photo|Vybrat fotografii)$/ }).click()
        const fileChooser = await chooser
        try {
          // Playwright 1.64.1 setFiles leaks its internal retargeted ElementHandle.
          // Perform the same File/DataTransfer and input/change dispatch without that extra handle.
          await fileChooser.element().evaluate((element, payload) => {
            const input = element as HTMLInputElement
            const bytes = Uint8Array.from(atob(payload.base64), (character) => character.charCodeAt(0))
            const transfer = new DataTransfer()
            transfer.items.add(new File([bytes], payload.name, { type: payload.mimeType, lastModified: 0 }))
            input.files = transfer.files
            element.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
          }, preview)
        } finally {
          // SPA navigation does not dispose Playwright's handle to this detached input.
          await fileChooser.element().dispose()
        }
        await expect(avatar.locator('img[src^="blob:"]')).toBeVisible()
        await expect
          .poll(() => page.evaluate(() => (window as ResourceWindow).__topiquResourceProtocol.activeUrls.size))
          .toBeGreaterThan(0)
        await page.keyboard.press('Escape')
        await expect(avatar).toBeHidden()
        await page.goBack()
        await expect(page.getByRole('heading', { name: articleTitle, exact: true })).toBeVisible()
        await expect(page.locator('.tiptap.ProseMirror')).toHaveCount(0)
        if ((await page.evaluate(() => performance.timeOrigin)) !== timeOrigin) report.documentReloads++
        expect(report.documentReloads, 'Every cycle must stay in one SPA document').toBe(0)
      }

      for (let number = 1; number <= warmupCycles; number++) {
        await cycle(number)
        if (number > warmupCycles - baselineSamples)
          report.baseline.push(await sampleResources(page, cdp, prototypeId, 0))
      }
      for (let number = 1; number <= cycles; number++) {
        await cycle(number)
        report.cyclesCompleted = number
        if (number % checkpointEvery === 0 || number === cycles) {
          report.stage = 'checkpoint'
          await waitForPageReady(page)
          report.samples.push(await sampleResources(page, cdp, prototypeId, number))
          console.log(JSON.stringify({ resourceCheckpoint: number, samples: report.samples.length }))
        }
      }
      report.growth = (['heapBytes', 'nodes', 'listeners', 'documents', 'detachedNodes', 'editors'] as const)
        .map((metric) => growthFor(metric, report.baseline, report.samples, cycles))
        .filter((growth): growth is Growth => growth !== null)
      if (report.samples.some((sample) => sample.detachedNodes === null))
        report.limitations.push('Detached DOM command unavailable in this Chromium build.')
      expect(
        report.growth.filter((growth) => growth.sustainedGrowth),
        'Investigate sustained post-cleanup retention above the declared warm-up noise budget',
      ).toEqual([])
      expect(report.canceledReads, 'At least the warmed delayed media read must be canceled').toBeGreaterThan(0)
      expect(report.forbiddenMutations, 'No upload, AI, email, billing or publication mutation is allowed').toBe(0)
      expect(report.pageErrors + report.consoleErrors + report.hydrationWarnings).toBe(0)
      report.stage = 'complete'
      report.status = cycles === 100 ? 'screen-passed' : 'smoke-passed'
    } finally {
      if (report.status === 'incomplete') {
        report.status = 'failed-or-incomplete'
        report.failureDiagnostics = {
          pathname: new URL(page.url()).pathname,
          pendingCount: pendingRequests.size,
          pendingFirstPartyRequests: [...pendingRequests.values()]
            .slice(0, 20)
            .map(({ method, pathname, startedAt }) => ({
              method,
              pathname,
              ageMs: Date.now() - startedAt,
            })),
        }
      }
      page.off('request', trackRequest)
      page.off('requestfinished', finishRequest)
      page.off('requestfailed', finishRequest)
      pendingRequests.clear()
      const evidence = testInfo.outputPath('resource-lifecycle.json')
      await writeFile(evidence, JSON.stringify(report, null, 2), { mode: 0o600 })
      await testInfo.attach('resource-lifecycle', {
        path: evidence,
        contentType: 'application/json',
      })
      await cdp.send('Runtime.releaseObjectGroup', { objectGroup: queryGroup }).catch(() => {})
      await cdp.send('Runtime.releaseObjectGroup', { objectGroup: prototypeGroup }).catch(() => {})
      await cdp.detach()
    }
  })
})
