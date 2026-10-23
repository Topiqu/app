import { effectScope, nextTick, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reportWebVitals = vi.hoisted(() => vi.fn())
vi.mock('../../app/utils/reportWebVitals', () => ({ reportWebVitals }))

const consent = shallowRef(false)
const fullPath = shallowRef('/en/articles/reader-story')
const route = {
  get fullPath() {
    return fullPath.value
  },
}
const config = {
  public: { appEnv: 'production', browserTest: false, sentry: { dsn: 'https://public@example.invalid/1' } },
}
mockNuxtImport('useRoute', () => () => route)
mockNuxtImport('useRuntimeConfig', () => () => config)
mockNuxtImport('useAnalyticsConsent', () => () => consent)
const stops: (() => void)[] = []
const scopes: ReturnType<typeof effectScope>[] = []
const app = { vueApp: { onUnmount: (stop: () => void) => stops.push(stop) } }
const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')

beforeEach(() => {
  vi.clearAllMocks()
  consent.value = false
  fullPath.value = '/en/articles/reader-story'
  config.public.appEnv = 'production'
  config.public.browserTest = false
  vi.spyOn(Math, 'random').mockReturnValue(0.05)
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: true })) })
})
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  for (const stop of stops.splice(0)) stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (previousMatchMedia) Object.defineProperty(window, 'matchMedia', previousMatchMedia)
  else Reflect.deleteProperty(window, 'matchMedia')
})

const start = async () => {
  const plugin = (await import('../../app/plugins/web-vitals.client')).default
  const scope = effectScope()
  scopes.push(scope)
  await scope.run(() => (plugin as unknown as (app: unknown) => unknown)(app))
  await nextTick()
}

describe('sampled consented CWV registration', () => {
  it('loads the reporting chunk only after analytics consent and registers once', async () => {
    await start()
    expect(reportWebVitals).not.toHaveBeenCalled()
    consent.value = true
    await vi.waitFor(() => expect(reportWebVitals).toHaveBeenCalledOnce())
    expect(reportWebVitals).toHaveBeenCalledWith('article', 'mobile', expect.any(Function))
    const allowed = reportWebVitals.mock.calls[0]![2] as () => boolean
    expect(allowed()).toBe(true)
    consent.value = false
    expect(allowed()).toBe(false)
    consent.value = true
    await nextTick()
    expect(reportWebVitals).toHaveBeenCalledOnce()
  })
  it('drops observations permanently once the document visits a sensitive route', async () => {
    consent.value = true
    await start()
    await vi.waitFor(() => expect(reportWebVitals).toHaveBeenCalledOnce())
    const allowed = reportWebVitals.mock.calls[0]![2] as () => boolean
    fullPath.value = '/en/integrations-connect?request=private'
    expect(allowed()).toBe(false)
    fullPath.value = '/en/articles/another-story'
    expect(allowed()).toBe(false)
  })
  it('stops reporting after the application unmounts even when consent remains granted', async () => {
    consent.value = true
    await start()
    await vi.waitFor(() => expect(reportWebVitals).toHaveBeenCalledOnce())
    const allowed = reportWebVitals.mock.calls[0]![2] as () => boolean
    for (const stop of stops.splice(0)) stop()
    expect(allowed()).toBe(false)
    consent.value = false
    consent.value = true
    await nextTick()
    expect(reportWebVitals).toHaveBeenCalledOnce()
  })
  it('samples once per document and excludes browser tests and non-production traffic', async () => {
    consent.value = true
    vi.mocked(Math.random).mockReturnValue(0.9)
    await start()
    expect(reportWebVitals).not.toHaveBeenCalled()
    vi.mocked(Math.random).mockReturnValue(0.05)
    config.public.browserTest = true
    await start()
    expect(reportWebVitals).not.toHaveBeenCalled()
    config.public.browserTest = false
    config.public.appEnv = 'development'
    await start()
    expect(reportWebVitals).not.toHaveBeenCalled()
  })
})
