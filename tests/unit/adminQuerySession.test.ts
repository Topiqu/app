import { createFetch } from 'ofetch'
import { createPinia, disposePinia } from 'pinia'
import { renderToString } from 'vue/server-renderer'
import { PiniaColada, useQuery } from '@pinia/colada'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { computed, createSSRApp, h, inject, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, getCookie, toWebHandler } from 'h3'

import { queryKeys } from '../../app/utils/queryKeys'
import { useBacklinks } from '../../app/composables/useBacklinks'
import { useKeywordPlan } from '../../app/composables/useKeywordPlan'
import { useContentActions } from '../../app/composables/useContentActions'

const { requestFetchKey, rawFetch } = vi.hoisted(() => ({
  requestFetchKey: Symbol('request-fetch'),
  rawFetch: vi.fn(),
}))
mockNuxtImport('$fetch', () => rawFetch)
mockNuxtImport('useRequestFetch', () => () => {
  const requestFetch = inject<ReturnType<typeof createFetch>>(requestFetchKey)
  if (!requestFetch) throw new Error('Request fetch must be captured in component setup')
  return requestFetch
})

const features = [
  { name: 'content actions', use: useContentActions, path: '/api/content-actions' },
  { name: 'backlinks', use: useBacklinks, path: '/api/backlinks' },
  { name: 'keyword plan', use: useKeywordPlan, path: '/api/keyword-plan' },
]
const piniaInstances: ReturnType<typeof createPinia>[] = []

const api = createApp().use(
  defineEventHandler((event) => {
    const session = getCookie(event, 'session')
    if (!session) throw createError({ statusCode: 401, message: 'Login required' })
    return { session, path: event.path, actions: [], running: false }
  }),
)
const handleApi = toWebHandler(api)
const apiFetch = createFetch({
  fetch: (request, options) => handleApi(new Request(request, options)),
  defaults: { baseURL: 'http://localhost', retry: 0 },
})

beforeEach(() => {
  rawFetch.mockImplementation(apiFetch)
  vi.stubGlobal('$fetch', rawFetch)
  vi.stubGlobal('useQuery', useQuery)
  vi.stubGlobal('queryKeys', queryKeys)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useIntervalFn', () => ({ pause: () => {}, resume: () => {} }))
})
afterEach(() => {
  piniaInstances.splice(0).forEach(disposePinia)
  vi.unstubAllGlobals()
})

const render = async (feature: (typeof features)[number], session?: string) => {
  let query: ReturnType<typeof feature.use> | undefined
  const app = createSSRApp({
    setup() {
      query = feature.use()
      return () => h('div', JSON.stringify(query!.data.value))
    },
  })
  const pinia = createPinia()
  piniaInstances.push(pinia)
  app.use(pinia).use(PiniaColada, { queryOptions: { ssrCatchError: true } })
  app.provide(requestFetchKey, apiFetch.create({ headers: session ? { cookie: `session=${session}` } : {} }))
  const html = await renderToString(app)
  return { query: query!, html }
}

describe.each(features)('$name session on reload', (feature) => {
  it('loads authenticated data during SSR and retains the request session for refetches', async () => {
    const { query, html } = await render(feature, 'signed-in-user')

    expect(query.error.value).toBeNull()
    expect(query.data.value).toMatchObject({ session: 'signed-in-user', path: feature.path })
    expect(html).toContain('signed-in-user')

    await query.refetch(true)
    expect(query.data.value).toMatchObject({ session: 'signed-in-user', path: feature.path })
  })

  it('keeps sessions isolated between server-rendered requests', async () => {
    const first = await render(feature, 'first-user')
    const second = await render(feature, 'second-user')

    expect(first.query.data.value).toMatchObject({ session: 'first-user' })
    expect(second.query.data.value).toMatchObject({ session: 'second-user' })
    await first.query.refetch(true)
    expect(first.query.data.value).toMatchObject({ session: 'first-user' })
  })

  it('preserves a 401 response when the request has no session', async () => {
    const { query } = await render(feature)

    expect(query.error.value).toMatchObject({ statusCode: 401 })
    expect(query.data.value).toBeUndefined()
  })
})
