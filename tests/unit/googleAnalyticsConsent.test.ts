// @vitest-environment nuxt

import type { MaybeRefOrGetter } from 'vue'

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { computed, defineComponent, h, nextTick, shallowRef, toValue } from 'vue'

import { useNuxtApp } from '#app'

import type { ConsentSite } from '../../shared/utils/consent'

import { consentCapabilities } from '../../shared/utils/consent'
import { configuredTagIds } from '../../node_modules/nuxt-gtag/dist/runtime/utils.js'
import { useGoogleAnalyticsConsent } from '../../app/composables/useGoogleAnalyticsConsent'

const analytics = shallowRef(false)
const marketing = shallowRef(false)
const guards: ((route: { meta: { shell: string } }) => void)[] = []
const removeGuard = vi.fn()
const config = {
  public: {
    gtag: {
      tags: [],
      url: 'https://www.googletagmanager.com/gtag/js',
      initMode: 'manual',
      config: { cookie_domain: 'none', allow_google_signals: false, allow_ad_personalization_signals: false },
      initCommands: [
        [
          'consent',
          'default',
          { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
        ],
      ],
    },
  },
}
mockNuxtImport('useHead', () => () => {})
mockNuxtImport('useConsent', () => (site: MaybeRefOrGetter<ConsentSite | null | undefined>) => ({
  capabilities: computed(() => consentCapabilities(toValue(site))),
  analyticsGranted: analytics,
  marketingGranted: marketing,
}))

const commands = () => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>))
const mountConsent = async () => {
  const site = shallowRef<ConsentSite>({ id: 'site-1', plan: 'PRO', allowGtag: true, gtagId: 'G-EXAMPLE123' })
  const enabled = shallowRef(true)
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useGoogleAnalyticsConsent(site, enabled)
        return () => h('div')
      },
    }),
  )
  return { wrapper, site, enabled }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(useNuxtApp().$config.public.gtag, config.public.gtag)
  vi.spyOn(useNuxtApp().$router, 'beforeEach').mockImplementation((guard) => {
    guards.push(guard as (route: { meta: { shell: string } }) => void)
    return removeGuard
  })
  configuredTagIds.clear()
  guards.length = 0
  analytics.value = false
  marketing.value = false
  Reflect.deleteProperty(window, 'dataLayer')
  for (const id of ['G-EXAMPLE123', 'G-NEXT456']) Reflect.deleteProperty(window, `ga-disable-${id}`)
})
afterEach(() => vi.restoreAllMocks())

describe('Google tag consent with nuxt-gtag 5', () => {
  it.each([false, true])('configures a tag exactly once with a preexisting dataLayer=%s', async (existing) => {
    if (existing) window.dataLayer = [['other-snippet']]
    const { wrapper } = await mountConsent()
    expect(commands().filter(([name]) => name === 'config')).toHaveLength(0)
    analytics.value = true
    await nextTick()
    const queued = commands()
    expect(queued.filter(([name]) => name === 'config')).toEqual([
      ['config', 'G-EXAMPLE123', config.public.gtag.config],
    ])
    expect(queued.findIndex(([name, action]) => name === 'consent' && action === 'default')).toBeLessThan(
      queued.findIndex(([name]) => name === 'config'),
    )
    expect(queued.at(-1)).toMatchObject([
      'consent',
      'update',
      { analytics_storage: 'granted', ad_storage: 'denied', ad_personalization: 'denied' },
    ])
    analytics.value = false
    await nextTick()
    analytics.value = true
    await nextTick()
    expect(commands().filter(([name]) => name === 'config')).toHaveLength(1)
    wrapper.unmount()
    expect(removeGuard).toHaveBeenCalledOnce()
    expect(window['ga-disable-G-EXAMPLE123']).toBe(true)
  })

  it('disables the previous tag on tenant change and disables collection before private navigation', async () => {
    analytics.value = true
    const { site, enabled } = await mountConsent()
    site.value = { ...site.value, id: 'site-2', gtagId: 'G-NEXT456' }
    await nextTick()
    expect(window['ga-disable-G-EXAMPLE123']).toBe(true)
    expect(
      commands()
        .filter(([name]) => name === 'config')
        .map(([, id]) => id),
    ).toEqual(['G-EXAMPLE123', 'G-NEXT456'])
    guards[0]!({ meta: { shell: 'dashboard' } })
    expect(window['ga-disable-G-NEXT456']).toBe(true)
    expect(commands().at(-1)).toMatchObject(['consent', 'update', { analytics_storage: 'denied' }])
    enabled.value = false
    await nextTick()
    expect(commands().filter(([name]) => name === 'config')).toHaveLength(2)
    enabled.value = true
    await nextTick()
    expect(window['ga-disable-G-NEXT456']).toBeUndefined()
    expect(commands().filter(([name]) => name === 'config')).toHaveLength(2)
  })
})
