// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdSenseStatus } from '../../app/composables/useAdSense'

import AdSenseSlot from '../../app/components/AdSenseSlot.vue'
import AdSenseLoader from '../../app/components/AdSenseLoader.vue'

const runtime = vi.hoisted(() => ({
  ready: null as (() => void) | null,
  resize: null as (() => void) | null,
}))
const status = shallowRef<AdSenseStatus>('idle')
const adWindow = window as unknown as { adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number } }
const wrappers: ReturnType<typeof mount>[] = []

mockNuxtImport('useAdSenseStatus', () => () => status)
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { adsensePublisherId: 'ca-pub-test' } }))
mockNuxtImport('useHead', () => () => {})
mockNuxtImport('onNuxtReady', () => (callback: () => void) => {
  runtime.ready = callback
})
mockNuxtImport('useResizeObserver', () => (_target: unknown, callback: () => void) => {
  runtime.resize = callback
})

const mountLoader = () => {
  const wrapper = mount(AdSenseLoader, { props: { enabled: true } })
  wrappers.push(wrapper)
  return wrapper
}
const mountSlot = () => {
  const wrapper = mount(AdSenseSlot, {
    props: { adSlot: 'test-slot' },
    global: { mocks: { $t: (key: string) => key } },
  })
  wrappers.push(wrapper)
  return wrapper
}
const adScript = () => document.head.querySelector<HTMLScriptElement>('script[src*="/adsbygoogle.js"]')

beforeEach(() => {
  status.value = 'idle'
  runtime.ready = runtime.resize = null
  delete adWindow.adsbygoogle
})
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.restoreAllMocks()
})

describe('AdSense lifecycle', () => {
  it('loads the external script only after Nuxt finishes hydrating', async () => {
    mountLoader()
    expect(status.value).toBe('loading')
    expect(adScript()).toBeNull()

    runtime.ready!()
    await nextTick()
    const script = adScript()!
    expect(script.src).toContain('adsbygoogle.js?client=ca-pub-')
    expect(script.getAttributeNames().sort()).toEqual(['async', 'crossorigin', 'src'])
    expect(adWindow.adsbygoogle?.requestNonPersonalizedAds).toBe(1)
    script.dispatchEvent(new Event('load'))
    expect(status.value).toBe('ready')
  })

  it('collapses the reserved ad space when the browser blocks the script', async () => {
    mountLoader()
    const slot = mountSlot()
    runtime.ready!()
    await nextTick()
    adScript()!.dispatchEvent(new Event('error'))
    await nextTick()

    expect(status.value).toBe('error')
    expect(slot.attributes('style')).toContain('display: none')
    expect(adWindow.adsbygoogle).toHaveLength(0)
  })

  it('does not reactivate ads if the pending script completes after consent is revoked', async () => {
    const loader = mountLoader()
    runtime.ready!()
    await nextTick()
    const script = adScript()!
    await loader.setProps({ enabled: false })
    script.dispatchEvent(new Event('load'))
    expect(status.value).toBe('idle')
    expect(adScript()).toBeNull()
  })

  it('waits for both the script and a visible width, then requests the unit only once', async () => {
    status.value = 'loading'
    const slot = mountSlot()
    status.value = 'ready'
    await nextTick()
    expect(adWindow.adsbygoogle).toBeUndefined()

    Object.defineProperty(slot.get('ins').element, 'clientWidth', { value: 160 })
    runtime.resize!()
    runtime.resize!()
    expect(adWindow.adsbygoogle).toEqual([{}])
  })

  it('requests a newly mounted unit when the script is already loaded', () => {
    status.value = 'ready'
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(160)
    mountSlot()
    expect(adWindow.adsbygoogle).toEqual([{}])
  })

  it('collapses a unit that AdSense rejects and reports the actual initialization error', async () => {
    status.value = 'ready'
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(160)
    const error = new Error('AdSense rejected this unit')
    adWindow.adsbygoogle = []
    vi.spyOn(adWindow.adsbygoogle, 'push').mockImplementation(() => {
      throw error
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const slot = mountSlot()
    await nextTick()
    expect(slot.attributes('style')).toContain('display: none')
    expect(warn).toHaveBeenCalledWith('[AdSense] Could not initialize the ad unit.', error)
  })
})
