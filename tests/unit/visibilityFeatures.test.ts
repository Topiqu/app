// @vitest-environment nuxt

import { shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Overview from '../../app/components/Stats/Visibility/Overview.vue'

const status = shallowRef({ id: 'tenant-1', plan: 'PREMIUM', activeFeatures: [] as string[] })
const data = shallowRef({
  generatedAt: new Date(0).toISOString(),
  windowDays: 30,
  crawlers: { requests: 0, uniquePages: 0, successes: 0, errors: 0, rateLimited: 0, byBot: [], recentPages: [] },
  referrals: { visits: 0, uniqueArticles: 0, byChannel: [] },
  visibility: {
    providers: [],
    successfulRuns: 0,
    citedRuns: 0,
    ownedRuns: 0,
    citationCoverage: null,
    brandMentionCoverage: null,
    ownedPages: 0,
  },
  prompts: [
    {
      id: 'prompt-1',
      text: 'Jak vybrat publikaci?',
      language: 'cs',
      active: true,
      source: 'MANUAL',
      latestRuns: [],
      article: null,
    },
  ],
  opportunities: [
    {
      id: 'opportunity-1',
      status: 'OPEN',
      kind: 'CREATE_ARTICLE',
      reason: 'NO_OWNED_CITATION',
      prompt: { id: 'prompt-1', text: 'Jak vybrat publikaci?' },
      article: null,
      citedDomains: [],
      sampleSize: 2,
      ownedHits: 0,
      externalHits: 2,
    },
  ],
  domains: { competitors: [], references: [], others: [], hidden: [] },
})
mockNuxtImport('useClientSiteStatus', () => async () => ({ data: status }))
mockNuxtImport('useQuery', () => () => ({ data, isPending: shallowRef(false), refetch: vi.fn() }))
mockNuxtImport('useTenantScope', () => () => () => true)
mockNuxtImport('useI18n', () => () => ({ locale: shallowRef('cs'), t: (key: string) => key }))
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))
mockNuxtImport(
  'useLocalePath',
  () => () => (route: string | { name: string }) =>
    typeof route === 'string' ? route : route.name === 'settings' ? '/settings?tab=ai' : '/admin/editor/new',
)
enableAutoUnmount(afterEach)

describe('visibility feature state', () => {
  it('replaces Enable AI with Create article in a mounted overview when the shared status refreshes', async () => {
    status.value = { id: 'tenant-1', plan: 'PREMIUM', activeFeatures: [] }
    const wrapper = await mountSuspended(Overview, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: { StatsVisibilityTraffic: true, StatsVisibilitySources: true },
      },
    })
    expect(wrapper.get('a[aria-label="visibility.opportunities.enableAi"]').attributes('href')).toContain('/settings')
    expect(wrapper.find('[aria-label="visibility.opportunities.create"]').exists()).toBe(false)
    status.value = { ...status.value, activeFeatures: ['AI'] }
    await flushPromises()
    expect(wrapper.get('a[aria-label="visibility.opportunities.create"]').attributes('href')).toContain(
      '/admin/editor/new',
    )
    expect(wrapper.find('[aria-label="visibility.opportunities.enableAi"]').exists()).toBe(false)
    status.value = { ...status.value, activeFeatures: [] }
    await flushPromises()
    expect(wrapper.find('[aria-label="visibility.opportunities.enableAi"]').exists()).toBe(true)
  })
})
