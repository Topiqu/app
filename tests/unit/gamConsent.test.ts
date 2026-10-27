import { shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import { useGamAds } from '../../app/composables/useGam'

const mocks = vi.hoisted(() => ({ granted: null as ReturnType<typeof shallowRef<boolean>> | null, enabled: false }))
vi.mock('~~/shared/utils/advertising', () => ({ tenantGamEnabled: () => mocks.enabled }))
mockNuxtImport('useMarketingConsent', () => () => mocks.granted)

describe('Google Ad Manager consent', () => {
  it('does not load GPT where tenant GAM is unavailable, even with stored marketing consent', async () => {
    mocks.enabled = false
    mocks.granted = shallowRef(true)
    const ads = useGamAds({ id: 'site-1', plan: 'PRO', gamNetworkCode: '123' })
    expect(await ads.initialize()).toBe(false)
    expect(document.head.querySelector('script[src*="/gpt.js"]')).toBeNull()
  })

  it('loads GPT only after consent, configures non-personalized ads, and stops new slots after revocation', async () => {
    mocks.enabled = true
    mocks.granted = shallowRef(false)
    const privacy = vi.fn(),
      enable = vi.fn(),
      setConfig = vi.fn(),
      defineSlot = vi.fn()
    const adWindow = window as unknown as { googletag: unknown }
    adWindow.googletag = {
      cmd: { push: (callback: () => void) => callback() },
      pubads: () => ({
        setPrivacySettings: privacy,
        enableSingleRequest: vi.fn(),
        collapseEmptyDivs: vi.fn(),
        enableLazyLoad: vi.fn(),
        setTargeting: vi.fn(),
      }),
      enableServices: enable,
      setConfig,
      defineSlot,
    }
    const ads = useGamAds({ id: 'site-1', plan: 'PRO', gamNetworkCode: '123' })
    expect(await ads.initialize()).toBe(false)
    expect(document.head.querySelector('script[src*="/gpt.js"]')).toBeNull()
    mocks.granted.value = true
    const ready = ads.initialize()
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="/gpt.js"]')!
    expect(script).not.toBeNull()
    script.dispatchEvent(new Event('load'))
    expect(await ready).toBe(true)
    expect(privacy).toHaveBeenCalledWith({ nonPersonalizedAds: true })
    expect(privacy.mock.invocationCallOrder[0]).toBeLessThan(enable.mock.invocationCallOrder[0]!)
    expect(setConfig).toHaveBeenCalledWith({ safeFrame: { forceSafeFrame: true } })
    expect(setConfig.mock.invocationCallOrder[0]).toBeLessThan(enable.mock.invocationCallOrder[0]!)
    mocks.granted.value = false
    expect(await ads.defineSlot('/article/body', [[300, 250]], 'slot')).toBe(false)
    expect(defineSlot).not.toHaveBeenCalled()
    script.remove()
    delete (window as unknown as { googletag?: unknown }).googletag
  })
})
