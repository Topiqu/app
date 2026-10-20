import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConsentDecision, ConsentSite } from '../../shared/utils/consent'

import { useConsent } from '../../app/composables/useConsent'
import { consentCapabilities, createConsentDecision } from '../../shared/utils/consent'
import { useGoogleAnalyticsConsent } from '../../app/composables/useGoogleAnalyticsConsent'

const mocks = vi.hoisted(() => ({
  cookie: null as ReturnType<typeof shallowRef<ConsentDecision | null>> | null,
  states: new Map<string, ReturnType<typeof shallowRef>>(),
  initialize: vi.fn(),
  gtag: vi.fn(),
  enableAnalytics: vi.fn(),
  disableAnalytics: vi.fn(),
  guard: null as ((to: { meta: { shell: string } }) => void) | null,
}))
mockNuxtImport('useCookie', () => () => mocks.cookie)
mockNuxtImport('useRequestURL', () => () => new URL('https://blog.example.com'))
mockNuxtImport('useState', () => (key: string, init: () => unknown) => {
  if (!mocks.states.has(key)) mocks.states.set(key, shallowRef(init()))
  return mocks.states.get(key)
})
mockNuxtImport('useGtag', () => () => mocks)
mockNuxtImport('useRouter', () => () => ({
  beforeEach: (guard: typeof mocks.guard) => {
    mocks.guard = guard
    return () => {
      mocks.guard = null
    }
  },
}))

let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  mocks.cookie = shallowRef(null)
  mocks.states.clear()
  vi.clearAllMocks()
  delete (window as unknown as { dataLayer?: unknown[] }).dataLayer
})
afterEach(() => wrapper?.unmount())

const setup = (initial: ConsentSite, enabled = shallowRef(true)) => {
  const site = shallowRef(initial)
  let consent!: ReturnType<typeof useConsent>
  wrapper = mount(
    defineComponent({
      setup() {
        consent = useConsent(site)
        useGoogleAnalyticsConsent(site, enabled)
        return () => h('div')
      },
    }),
  )
  return { site, consent, enabled }
}

describe('Google Analytics consent lifecycle', () => {
  const gaSite = { id: 'site-1', plan: 'PRO', allowGtag: true, gtagId: 'G-ONE123' }

  it('loads no Google tag before consent or after rejection', async () => {
    const { consent } = setup(gaSite)
    expect(mocks.initialize).not.toHaveBeenCalled()
    consent.rejectAll()
    await nextTick()
    expect(mocks.initialize).not.toHaveBeenCalled()
    expect(mocks.cookie?.value?.analytics).toBe(false)
  })

  it('requires a new choice before adding GA4 to previously accepted internal statistics', async () => {
    const { site, consent } = setup({ id: 'site-1', plan: 'PRO' })
    consent.acceptAll()
    await nextTick()
    site.value = gaSite
    await nextTick()
    expect(consent.needsDecision.value).toBe(true)
    expect(consent.analyticsGranted.value).toBe(false)
    expect(mocks.initialize).not.toHaveBeenCalled()
    consent.acceptAll()
    await nextTick()
    expect(mocks.initialize).toHaveBeenCalledExactlyOnceWith('G-ONE123')
    expect(mocks.cookie?.value?.configuration).toBe(consentCapabilities(gaSite).configuration)
  })

  it('stops the previous ID and waits for consent when a GA4 property changes', async () => {
    const { site, consent } = setup(gaSite)
    consent.acceptAll()
    await nextTick()
    site.value = { ...gaSite, gtagId: 'G-TWO456' }
    await nextTick()
    expect(mocks.disableAnalytics).toHaveBeenCalledWith('G-ONE123')
    expect(mocks.initialize).toHaveBeenCalledTimes(1)
    consent.acceptAll()
    await nextTick()
    expect(mocks.initialize).toHaveBeenLastCalledWith('G-TWO456')
  })

  it('revokes measurement and deletes first-party GA cookies', async () => {
    const { consent } = setup(gaSite)
    consent.acceptAll()
    await nextTick()
    document.cookie = '_ga=visitor; Path=/'
    document.cookie = '_ga_ONE123=session; Path=/'
    consent.rejectAll()
    await nextTick()
    expect(mocks.disableAnalytics).toHaveBeenCalledWith('G-ONE123')
    expect(document.cookie).not.toContain('_ga')
    expect(mocks.gtag).toHaveBeenLastCalledWith(
      'consent',
      'update',
      expect.objectContaining({ analytics_storage: 'denied' }),
    )
  })

  it('keeps halted advertising denied even when a saved choice requests Marketing', async () => {
    const { consent } = setup({ ...gaSite, gamNetworkCode: '123' })
    consent.save({ analytics: false, marketing: true })
    await nextTick()
    expect(consent.marketingGranted.value).toBe(false)
    expect(mocks.initialize).not.toHaveBeenCalled()
    consent.save({ analytics: true, marketing: true })
    await nextTick()
    expect(mocks.gtag).toHaveBeenLastCalledWith(
      'consent',
      'update',
      expect.objectContaining({
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_personalization: 'denied',
      }),
    )
  })

  it('configures GA4 even when another integration already created dataLayer', async () => {
    ;(window as unknown as { dataLayer: unknown[] }).dataLayer = []
    mocks.cookie!.value = createConsentDecision(consentCapabilities(gaSite), { analytics: true, marketing: false })
    setup(gaSite)
    expect(mocks.gtag).toHaveBeenCalledWith('config', 'G-ONE123', expect.objectContaining({ cookie_domain: 'none' }))
  })

  it('does not load the tag on administrative surfaces', () => {
    mocks.cookie!.value = createConsentDecision(consentCapabilities(gaSite), { analytics: true, marketing: false })
    setup(gaSite, shallowRef(false))
    expect(mocks.initialize).not.toHaveBeenCalled()
  })

  it('stops Google measurement when the consent cookie is changed outside this component', async () => {
    const { consent } = setup(gaSite)
    consent.acceptAll()
    await nextTick()
    mocks.cookie!.value = createConsentDecision(consentCapabilities(gaSite), { analytics: false, marketing: false })
    await nextTick()
    expect(consent.analyticsGranted.value).toBe(false)
    expect(mocks.disableAnalytics).toHaveBeenCalledWith('G-ONE123')
  })

  it('disables GA4 before navigation to a private page can emit a history event', async () => {
    const { consent } = setup(gaSite)
    consent.acceptAll()
    await nextTick()
    mocks.disableAnalytics.mockClear()
    mocks.guard!({ meta: { shell: 'dashboard' } })
    expect(mocks.disableAnalytics).toHaveBeenCalledWith('G-ONE123')
    expect(mocks.gtag).toHaveBeenLastCalledWith('consent', 'update', { analytics_storage: 'denied' })
  })
})
