// @vitest-environment nuxt

import { defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, useNuxtApp } from '#app'

import { useArticleRevisions } from '../../app/composables/useArticleRevisions'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
const mountHistory = async (articleId = 'revision-article') => {
  let state!: Awaited<ReturnType<typeof useArticleRevisions>>
  const wrapper = await mountSuspended(
    defineComponent({
      async setup() {
        state = await useArticleRevisions(articleId)
        return () => h('div', JSON.stringify(state.data.value))
      },
    }),
  )
  await flushPromises()
  return { wrapper, state }
}
enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('article-revisions-'))
  mocks.fetch.mockReset().mockResolvedValue([{ id: 'first', title: 'First version' }])
})
afterEach(() => {
  useNuxtApp().isHydrating = false
})

describe('revision history requests', () => {
  it('loads fresh history on reopen and manual refresh instead of reusing SSR or static data', async () => {
    const app = useNuxtApp()
    const key = 'article-revisions-revision-article'
    app.payload.data[key] = [{ id: 'stale-ssr', title: 'Stale server history' }]
    app.static.data[key] = [{ id: 'stale-static', title: 'Stale static history' }]
    app.payload.serverRendered = true
    app.isHydrating = true
    const first = await mountHistory()
    expect(first.wrapper.text()).toContain('First version')
    expect(first.wrapper.text()).not.toContain('Stale')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    first.wrapper.unmount()
    await flushPromises()
    app.isHydrating = false
    mocks.fetch.mockResolvedValueOnce([{ id: 'new', title: 'Saved after close' }])
    const second = await mountHistory()
    expect(second.wrapper.text()).toContain('Saved after close')
    mocks.fetch.mockResolvedValueOnce([{ id: 'newest', title: 'Saved while open' }])
    await second.state.refresh()
    expect(second.wrapper.text()).toContain('Saved while open')
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
  })

  it('isolates article keys and aborts an outstanding read on unmount', async () => {
    const first = await mountHistory('first-article')
    const second = await mountHistory('second-article')
    let resolve!: (rows: unknown[]) => void
    mocks.fetch.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res
      }),
    )
    const refreshing = first.state.refresh()
    const signal = mocks.fetch.mock.lastCall?.[1].signal as AbortSignal
    first.wrapper.unmount()
    expect(signal.aborted).toBe(true)
    resolve([{ id: 'late', title: 'Old owner' }])
    await refreshing
    expect(second.wrapper.text()).toContain('First version')
    expect(second.wrapper.text()).not.toContain('Old owner')
    expect(mocks.fetch.mock.calls.slice(0, 2).map(([path]) => path)).toEqual([
      '/api/articles/first-article/revisions',
      '/api/articles/second-article/revisions',
    ])
  })
})
