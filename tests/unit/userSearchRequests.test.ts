// @vitest-environment nuxt

import { defineComponent, h, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { useUserSearch } from '../../app/composables/useUserSearch'

const mocks = vi.hoisted(() => ({ fetch: vi.fn().mockResolvedValue({ data: [], total: 0 }) }))
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
enableAutoUnmount(afterEach)

describe('manual user search query ownership', () => {
  it('waits for an explicit search, retains page/query changes without auto-fetch and aborts a pending refresh on unmount', async () => {
    const page = shallowRef(1)
    const search = shallowRef('')
    let state!: ReturnType<typeof useUserSearch>
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          state = useUserSearch(page, search)
          return () => h('div', JSON.stringify(state.data.value))
        },
      }),
    )
    await flushPromises()
    expect(mocks.fetch).not.toHaveBeenCalled()
    page.value = 2
    search.value = 'person'
    await flushPromises()
    expect(mocks.fetch).not.toHaveBeenCalled()
    await state.refresh()
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/users?page=2&query=person',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    let resolve!: (value: { data: never[]; total: number }) => void
    mocks.fetch.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res
      }),
    )
    const refresh = state.refresh()
    const signal = mocks.fetch.mock.lastCall?.[1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    resolve({ data: [], total: 0 })
    await refresh
  })
})
