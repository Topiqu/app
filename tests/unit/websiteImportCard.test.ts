// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef, type ShallowRef } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import type { WebsiteImportResponse, WebsiteImportView } from '../../shared/utils/websiteImport'

import Entry from '../../app/components/WebsiteImport/Entry.vue'
import Panel from '../../app/components/WebsiteImport/Panel.vue'

const mocks = vi.hoisted(() => ({
  data: undefined as unknown as ShallowRef<WebsiteImportResponse | null>,
  status: undefined as unknown as ShallowRef<{ plan: string; setup: { hasDraft: boolean } }>,
}))
mockNuxtImport('useWebsiteImport', () => () => ({
  data: mocks.data,
  error: shallowRef(null),
  pending: shallowRef(false),
  enabled: shallowRef(true),
  apply: vi.fn(),
  start: vi.fn(),
  refresh: vi.fn(),
}))
mockNuxtImport('useClientSiteStatus', () => () => ({ data: mocks.status }))
mockNuxtImport('useTenantScope', () => () => () => true)

const values = { ...emptyWebsiteValues(), focus: 'Výběrová káva' }
const job = (status: WebsiteImportView['status']): WebsiteImportResponse => ({
  websiteUrl: 'https://firma.cz/',
  import: {
    id: 'import-1',
    sourceUrl: 'https://firma.cz/',
    status,
    result: { values, sources: [], warnings: [], topics: [] },
    current: emptyWebsiteValues(),
    expected: {},
    knowledge: [],
    acceptedFields: [],
    errorCode: status === 'FAILED' ? 'PROVIDER_FAILED' : null,
    progress: null,
  },
})
const Settings = defineComponent(() => () => [h(Entry), h(Panel)])
const mount = async () => {
  const wrapper = await mountSuspended(Settings)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mocks.data = shallowRef(null)
  mocks.status = shallowRef({ plan: 'PRO', setup: { hasDraft: true } })
  useState('website-import-rerun').value = false
})

describe('website import card in settings', () => {
  it('leaves only a header entry once the suggestions are reviewed', async () => {
    mocks.data.value = job('REVIEWED')
    const wrapper = await mount()
    expect(wrapper.find('[data-website-import-panel]').exists()).toBe(false)
    await wrapper.get('[data-website-import-entry]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-website-import-start]').exists()).toBe(true)
    expect(wrapper.find('[data-website-import-entry]').exists()).toBe(false)
    await wrapper.get('[data-website-import-cancel]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-website-import-panel]').exists()).toBe(false)
    expect(wrapper.find('[data-website-import-entry]').exists()).toBe(true)
  })

  it('keeps the card while a reviewed import still leads to the first article', async () => {
    mocks.data.value = job('REVIEWED')
    mocks.status.value = { plan: 'PRO', setup: { hasDraft: false } }
    const wrapper = await mount()
    expect(wrapper.find('[data-website-import-next]').exists()).toBe(true)
    expect(wrapper.find('[data-website-import-entry]').exists()).toBe(false)
  })

  it.each(['PENDING', 'PROCESSING', 'READY', 'FAILED'] as const)('shows the card for a %s import', async (status) => {
    mocks.data.value = job(status)
    const wrapper = await mount()
    expect(wrapper.find('[data-website-import-panel]').exists()).toBe(true)
    expect(wrapper.find('[data-website-import-entry]').exists()).toBe(false)
  })

  it('offers a first import only from the header, and nothing without an AI plan', async () => {
    mocks.data.value = { websiteUrl: null, import: null }
    const wrapper = await mount()
    expect(wrapper.find('[data-website-import-panel]').exists()).toBe(false)
    expect(wrapper.find('[data-website-import-entry]').exists()).toBe(true)
    mocks.status.value = { plan: 'BASIC', setup: { hasDraft: true } }
    await flushPromises()
    expect(wrapper.find('[data-website-import-entry]').exists()).toBe(false)
  })
})
