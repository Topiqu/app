// @vitest-environment nuxt

import { useQueryCache } from '@pinia/colada'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { useNuxtApp } from '#app'

import Manager from '../../app/components/Tags/Manager.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
const tags = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
]
const cache = () => useNuxtApp().vueApp.runWithContext(() => useQueryCache())
const clearTags = () =>
  cache()
    .getEntries()
    .filter((entry) => ['tags', 'articles'].includes(String(entry.key[0])))
    .forEach((entry) => cache().remove(entry))
enableAutoUnmount(afterEach)
beforeEach(() => {
  clearTags()
  mocks.fetch
    .mockReset()
    .mockImplementation((path: string) =>
      Promise.resolve(path === '/api/tags' ? tags : [{ tagId: 'alpha', tag: tags[0] }]),
    )
})
afterEach(clearTags)
const mountManager = (props: { initialTags?: string[] } = {}) =>
  mountSuspended(Manager, {
    props,
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UFormField: { template: '<div><slot /></div>' },
        USelectMenu: {
          name: 'USelectMenu',
          props: ['items', 'modelValue'],
          emits: ['update:modelValue'],
          template: '<select />',
        },
        UCollapsible: { template: '<div><slot /><slot name="content" /></div>' },
        UInput: true,
        UButton: { template: '<button><slot /></button>' },
      },
    },
  })

describe('tag manager query integration', () => {
  it('keeps draft and recovered tag selections authoritative while preserving add/remove events', async () => {
    const wrapper = await mountManager({ initialTags: ['beta'] })
    await flushPromises()
    const selected = () => wrapper.get('[aria-label="articles.tags.selected"]')
    expect(selected().text()).toBe('Beta')
    await wrapper.setProps({ initialTags: ['alpha'] })
    expect(selected().text()).toBe('Alpha')
    wrapper.getComponent({ name: 'USelectMenu' }).vm.$emit('update:modelValue', 'beta')
    await flushPromises()
    expect(wrapper.emitted('add:tag')).toEqual([['beta']])
    expect(selected().text()).toBe('AlphaBeta')
    await selected().get('button').trigger('click')
    expect(wrapper.emitted('delete:tag')).toEqual([['alpha']])
    expect(selected().text()).toBe('Beta')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('updates available tags after shared cache invalidation without replacing a draft selection', async () => {
    const wrapper = await mountManager({ initialTags: ['alpha'] })
    await flushPromises()
    mocks.fetch.mockResolvedValueOnce([...tags, { id: 'new', name: 'New tag' }])
    await cache().invalidateQueries({ key: ['tags'] })
    await flushPromises()
    expect(wrapper.getComponent({ name: 'USelectMenu' }).props('items')).toEqual([
      { id: 'beta', name: 'Beta' },
      { id: 'new', name: 'New tag' },
    ])
    expect(wrapper.get('[aria-label="articles.tags.selected"]').text()).toBe('Alpha')
  })
})
