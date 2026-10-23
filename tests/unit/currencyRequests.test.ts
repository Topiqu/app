// @vitest-environment nuxt
import { defineComponent, h, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, useNuxtApp } from '#app'

import { useCurrencyRate } from '../../app/composables/useCurrency'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('rate-'))
  mocks.fetch.mockReset().mockResolvedValue({ rate: 0.92 })
})
afterEach(() => {
  useNuxtApp().isHydrating = false
})

describe('currency request ownership', () => {
  it('reuses SSR rates and follows normalized currency changes', async () => {
    const app = useNuxtApp()
    app.payload.data['rate-EUR'] = { rate: 0.85 }
    app.payload.serverRendered = true
    app.isHydrating = true
    const target = shallowRef<string | null>('eur')
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          const rate = useCurrencyRate(() => target.value)
          return () => h('div', String(rate.value))
        },
      }),
    )
    await flushPromises()
    expect(wrapper.text()).toBe('0.85')
    expect(mocks.fetch).not.toHaveBeenCalled()
    app.isHydrating = false
    mocks.fetch.mockResolvedValueOnce({ rate: 0.77 })
    target.value = 'gbp'
    await flushPromises()
    expect(wrapper.text()).toBe('0.77')
    expect(mocks.fetch.mock.lastCall?.[0]).toBe('/api/currency')
    expect(mocks.fetch.mock.lastCall?.[1].query.target).toBe('GBP')
    mocks.fetch.mockResolvedValueOnce({ rate: 1 })
    target.value = null
    await flushPromises()
    expect(wrapper.text()).toBe('1')
    expect(mocks.fetch.mock.lastCall?.[1].query.target).toBe('USD')
  })

  it('releases the caller getter and cancels its read when unmounted', async () => {
    const target = shallowRef('JPY')
    let reads = 0
    let resolve!: (result: { rate: number }) => void
    mocks.fetch.mockReturnValueOnce(new Promise((done) => (resolve = done)))
    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          const rate = useCurrencyRate(() => {
            reads++
            return target.value
          })
          return () => h('div', String(rate.value))
        },
      }),
    )
    await flushPromises()
    expect(wrapper.text()).toBe('1')
    const signal = mocks.fetch.mock.lastCall?.[1].signal as AbortSignal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    const before = reads
    target.value = 'CHF'
    resolve({ rate: 100 })
    await flushPromises()
    expect(reads).toBe(before)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
})
