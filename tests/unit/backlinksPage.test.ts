// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { nextTick, shallowRef, type ShallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import type { useBacklinks } from '../../app/composables/useBacklinks'

import BacklinksPage from '../../app/pages/admin/backlinks.vue'

type BacklinksData = NonNullable<ReturnType<typeof useBacklinks>['data']['value']>
const mocks = vi.hoisted(() => ({
  data: undefined as unknown as ShallowRef<BacklinksData>,
  refetch: vi.fn(),
  discover: vi.fn(),
}))
mockNuxtImport('useBacklinks', () => () => ({
  data: mocks.data,
  error: shallowRef(null),
  isPending: shallowRef(false),
  refetch: mocks.refetch,
}))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key, locale: shallowRef('en') }))
registerEndpoint('/api/backlinks/discover', {
  method: 'POST',
  handler: () => {
    mocks.discover()
    return {}
  },
})

const mounted: Array<{ unmount: () => void }> = []
const mount = async () => {
  const wrapper = await mountSuspended(BacklinksPage, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        BacklinksOpportunities: { template: '<div data-opportunities />' },
        BacklinksLinks: { template: '<div data-links />' },
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.data = shallowRef<BacklinksData>({
    allowance: { kinds: ['UNLINKED_MENTION'], drafts: false },
    available: true,
    refreshedAt: '2026-10-20T00:00:00Z',
    running: false,
    nextManualAt: '2099-10-27T00:00:00Z',
    won: 0,
    opportunities: [],
    links: [],
  })
})
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('backlinks empty state', () => {
  it('replaces both empty lists with one explanation and respects the search cooldown', async () => {
    const wrapper = await mount()
    expect(wrapper.text()).toContain('backlinks.empty.title')
    expect(wrapper.findAll('ol li')).toHaveLength(3)
    expect(wrapper.find('[data-opportunities]').exists()).toBe(false)
    expect(wrapper.find('[data-links]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('backlinks.stats.won.hint')
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === 'backlinks.refresh')
        ?.attributes('disabled'),
    ).toBeDefined()
  }, 30_000)

  it('starts an available search and replaces the empty heading while discovery runs', async () => {
    mocks.data.value = { ...mocks.data.value, nextManualAt: null }
    const wrapper = await mount()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'backlinks.refresh')!
      .trigger('click')
    await flushPromises()
    expect(mocks.discover).toHaveBeenCalledOnce()
    expect(mocks.refetch).toHaveBeenCalledOnce()
    mocks.data.value = { ...mocks.data.value, running: true }
    await nextTick()
    expect(wrapper.get('h2').text()).toBe('backlinks.running')
    expect(wrapper.text()).not.toContain('backlinks.empty.title')
  })

  it('shows real results and the outreach note when a link has been won', async () => {
    mocks.data.value = {
      ...mocks.data.value,
      won: 1,
      links: [
        {
          id: 'verified-link',
          sourceUrl: 'https://example.com/article',
          sourceDomain: 'example.com',
          targetUrl: 'https://blog.example.com',
          rel: [],
          anchor: 'Our blog',
          firstSeenAt: '2026-10-20T00:00:00Z',
          lastSeenAt: '2026-10-20T00:00:00Z',
          lostAt: null,
          opportunityId: 'won-opportunity',
        },
      ],
    }
    const wrapper = await mount()
    expect(wrapper.find('[data-opportunities]').exists()).toBe(true)
    expect(wrapper.find('[data-links]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('backlinks.empty.title')
    expect(wrapper.text()).toContain('backlinks.stats.won.hint')
  })
})
