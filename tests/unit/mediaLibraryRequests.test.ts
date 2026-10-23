// @vitest-environment nuxt

import { nextTick, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import { clearNuxtData, useNuxtApp } from '#app'

import type { MediaLibraryPage } from '../../shared/types/mediaLibrary'

import Library from '../../app/components/Media/Library.vue'
import * as asyncDataRequest from '../../app/utils/asyncDataRequest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), id: vi.fn() }))
const auth = shallowRef({ user: { id: 'user-1', clientSiteId: 'tenant-1' } })
mockNuxtImport('useRequestFetch', () => () => mocks.fetch)
mockNuxtImport('useAuth', () => () => ({ data: auth }))
mockNuxtImport('useId', () => () => mocks.id())
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const response = (name = 'Initial image', total = 1): MediaLibraryPage => ({
  items: [
    {
      id: name,
      name,
      url: '/image.webp',
      origin: 'OWN',
      attributionRequired: false,
      machineTags: [],
      createdAt: '2026-10-22',
      usageCount: 0,
    },
  ],
  page: 1,
  pageSize: 30,
  total,
})
const deferred = () => {
  let resolve!: (page: MediaLibraryPage) => void
  let reject!: (error: Error) => void
  const promise = new Promise<MediaLibraryPage>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const initialKey = 'media-library:library-test:user-1:tenant-1'

const global = {
  mocks: { $t: (key: string) => key },
  stubs: {
    UFormField: { template: '<div><slot /></div>' },
    UInput: { name: 'UInput', props: ['modelValue'], emits: ['update:modelValue'], template: '<input />' },
    USelect: { name: 'USelect', props: ['modelValue'], emits: ['update:modelValue'], template: '<select />' },
    USwitch: {
      name: 'USwitch',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input type="checkbox" />',
    },
    UPagination: { name: 'UPagination', props: ['page'], emits: ['update:page'], template: '<nav />' },
    UButton: { template: '<button><slot /></button>' },
    UAlert: { template: '<div role="alert"><slot name="actions" /></div>' },
    UEmpty: { template: '<div data-empty />' },
    USkeleton: true,
    AppMedia: true,
  },
}

const mountLibrary = (props: { selectable?: boolean; selectedId?: string | null } = {}) =>
  mountSuspended(Library, { props, global })

enableAutoUnmount(afterEach)
beforeEach(() => {
  clearNuxtData((key) => key.startsWith('media-library:'))
  auth.value = { user: { id: 'user-1', clientSiteId: 'tenant-1' } }
  mocks.fetch.mockReset().mockResolvedValue(response())
  mocks.id.mockReset().mockReturnValue('library-test')
})
afterEach(() => {
  useNuxtApp().isHydrating = false
  vi.restoreAllMocks()
})

describe('media library loading', () => {
  it('keeps simultaneously mounted picker filters and cancellation independent', async () => {
    mocks.id.mockReturnValueOnce('left-library').mockReturnValueOnce('right-library')
    mocks.fetch.mockImplementation((_path, { query }) => Promise.resolve(response(`asset-${query.origin ?? 'all'}`)))
    const left = await mountLibrary()
    const right = await mountLibrary()
    await flushPromises()
    left.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'OWN')
    await flushPromises()
    expect(left.text()).toContain('asset-OWN')
    expect(right.text()).toContain('asset-all')
    expect(right.text()).not.toContain('asset-OWN')

    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const refresh = left.vm.reload()
    const leftSignal = mocks.fetch.mock.lastCall?.[1].signal as AbortSignal
    left.unmount()
    expect(leftSignal.aborted).toBe(true)
    expect(right.text()).toContain('asset-all')
    pending.resolve(response('Unmounted left'))
    await refresh
    expect(right.text()).not.toContain('Unmounted left')
  })

  it('reuses one instance cache record across filter changes and disposes its retained request callback', async () => {
    const wrapper = await mountLibrary()
    await flushPromises()
    const origin = wrapper.findAllComponents({ name: 'USelect' })[0]!
    for (const value of ['OWN', 'EXTERNAL', 'all']) {
      origin.vm.$emit('update:modelValue', value)
      await flushPromises()
    }
    expect(Object.keys(useNuxtApp()._asyncData).filter((key) => key.startsWith('media-library:library-test:'))).toEqual(
      [initialKey],
    )

    const callback = vi.fn().mockResolvedValue(response())
    const request = asyncDataRequest.createAsyncDataRequest(callback)
    const signal = new AbortController().signal
    await request.fetch(useNuxtApp(), { signal })
    request.dispose()
    request.dispose()
    await expect(request.fetch(useNuxtApp(), { signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(signal)
  })

  it('hydrates an existing SSR payload without a duplicate request and explicitly reloads fresh data', async () => {
    const nuxtApp = useNuxtApp()
    nuxtApp.payload.data[initialKey] = response('SSR image')
    nuxtApp.payload.serverRendered = true
    nuxtApp.isHydrating = true
    const wrapper = await mountLibrary()
    await flushPromises()

    expect(wrapper.text()).toContain('SSR image')
    expect(mocks.fetch).not.toHaveBeenCalled()

    mocks.fetch.mockResolvedValueOnce(response('Updated image'))
    await wrapper.vm.reload()
    await flushPromises()

    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Updated image')
    expect(wrapper.text()).not.toContain('SSR image')
  })

  it('keeps the newest filter response when a canceled request resolves late', async () => {
    const wrapper = await mountLibrary()
    await flushPromises()
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const origin = wrapper.findAllComponents({ name: 'USelect' })[0]!
    origin.vm.$emit('update:modelValue', 'OWN')
    await nextTick()
    origin.vm.$emit('update:modelValue', 'EXTERNAL')
    await nextTick()
    second.resolve(response('Newest image'))
    await flushPromises()
    first.resolve(response('Stale image'))
    await flushPromises()

    expect(wrapper.text()).toContain('Newest image')
    expect(wrapper.text()).not.toContain('Stale image')
    expect(mocks.fetch.mock.calls[1]?.[1].signal.aborted).toBe(true)
  })

  it('does not let stale failure replace a newer success and retains content on current refresh failure', async () => {
    const wrapper = await mountLibrary()
    await flushPromises()
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const oldRefresh = wrapper.vm.reload()
    const refresh = wrapper.vm.reload()
    second.resolve(response('Newest image'))
    await refresh
    first.reject(new Error('Stale failure'))
    await oldRefresh
    await flushPromises()
    expect(wrapper.text()).toContain('Newest image')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    mocks.fetch.mockRejectedValueOnce(new Error('Current failure'))
    await wrapper.vm.reload()
    await flushPromises()
    expect(wrapper.text()).toContain('Newest image')
    expect(wrapper.find('[data-empty]').exists()).toBe(false)
  })

  it('resets pagination when a filter changes and does not render another tenant while fetching', async () => {
    mocks.fetch.mockResolvedValue(response('First tenant image', 70))
    const wrapper = await mountLibrary()
    await flushPromises()
    wrapper.getComponent({ name: 'UPagination' }).vm.$emit('update:page', 3)
    await flushPromises()
    expect(mocks.fetch.mock.lastCall?.[1].query.page).toBe(3)

    wrapper.findAllComponents({ name: 'USelect' })[1]!.vm.$emit('update:modelValue', 'unused')
    await flushPromises()
    expect(mocks.fetch.mock.lastCall?.[1].query).toMatchObject({ page: 1, usage: 'unused' })

    const pending = deferred()
    mocks.fetch.mockReturnValue(pending.promise)
    auth.value = { user: { id: 'user-2', clientSiteId: 'tenant-2' } }
    await nextTick()
    expect(wrapper.text()).not.toContain('First tenant image')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    pending.resolve(response('Second tenant image'))
    await flushPromises()
    expect(wrapper.text()).toContain('Second tenant image')
  })

  it('cancels active work on unmount and follows reactive selection props', async () => {
    const factory = vi.spyOn(asyncDataRequest, 'createAsyncDataRequest')
    const wrapper = await mountLibrary()
    await flushPromises()
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('inspect')?.[0]).toEqual(['Initial image'])
    await wrapper.setProps({ selectable: true, selectedId: 'Initial image' })
    await wrapper.get('article').trigger('keydown.enter')
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'Initial image' })
    expect(wrapper.get('article').classes()).toContain('border-primary')

    const pending = deferred()
    mocks.fetch.mockReturnValue(pending.promise)
    const refresh = wrapper.vm.reload()
    wrapper.unmount()
    expect(mocks.fetch.mock.lastCall?.[1].signal.aborted).toBe(true)
    await expect(
      factory.mock.results[0]!.value.fetch(useNuxtApp(), { signal: new AbortController().signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    pending.resolve(response('Unmounted'))
    await refresh
  })
})
