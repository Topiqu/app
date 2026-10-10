import { mount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h, onMounted, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useArticleTracking } from '../../app/composables/useArticleTracking'

const mocks = vi.hoisted(() => ({ granted: null as ReturnType<typeof shallowRef<boolean>> | null, fetch: vi.fn() }))
mockNuxtImport('useAnalyticsConsent', () => () => mocks.granted)
mockNuxtImport('$fetch', () => mocks.fetch)
let wrapper: ReturnType<typeof mount> | undefined
const setup = () => {
  let tracker!: ReturnType<typeof useArticleTracking>
  wrapper = mount(
    defineComponent({
      setup() {
        tracker = useArticleTracking(shallowRef('a1'))
        onMounted(tracker.trackView)
        return () => h('div')
      },
    }),
  )
  return tracker
}
beforeEach(() => {
  mocks.granted = shallowRef(false)
  mocks.fetch.mockReset().mockResolvedValue({ counted: true })
  sessionStorage.clear()
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
})

describe('first-party article measurement', () => {
  it('does not read or write optional view storage before consent', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    setup()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalledWith('viewed-a1')
    expect(write).not.toHaveBeenCalled()
  })
  it('counts a pending view after consent and suppresses a repeated view', async () => {
    const tracker = setup()
    mocks.granted!.value = true
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('viewed-a1')).not.toBeNull()
    tracker.trackView()
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })
  it('aborts pending measurement and does not restore storage after revocation', async () => {
    let resolve!: (result: { counted: boolean }) => void
    mocks.fetch.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    mocks.granted!.value = true
    setup()
    const signal = mocks.fetch.mock.calls[0]![1].signal as AbortSignal
    mocks.granted!.value = false
    await flushPromises()
    expect(signal.aborted).toBe(true)
    resolve({ counted: true })
    await flushPromises()
    expect(sessionStorage.getItem('viewed-a1')).toBeNull()
  })
})
