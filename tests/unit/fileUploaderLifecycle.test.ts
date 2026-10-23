// @vitest-environment nuxt

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

import Uploader from '../../app/components/File/Uploader.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useToast', () => () => ({ add: mocks.toast }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

class PendingImage {
  naturalWidth = 1200
  naturalHeight = 800
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
}
const images: PendingImage[] = []
const revokeObjectURL = vi.fn()
const createObjectURL = vi.fn()
const file = (name = 'photo.png') => new File(['image'], name, { type: 'image/png' })
const mountUploader = (props: Partial<InstanceType<typeof Uploader>['$props']> = {}) =>
  mount(Uploader, {
    props: { imageUrl: '/initial.webp', ...props },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UFormField: { template: '<div><slot /></div>' },
        UFileUpload: {
          name: 'UFileUpload',
          props: ['modelValue'],
          template: '<div><slot name="file" /><slot name="leading" /></div>',
        },
        UButton: { name: 'UButton', props: ['icon'], template: '<button><slot /></button>' },
        AppMedia: { props: ['src'], template: '<img :src="src" />' },
        UProgress: true,
        UBadge: true,
      },
    },
  })
const deferred = () => {
  let resolve!: (result: { url: string; optimizedUrl: string }) => void
  let reject!: (error: Error) => void
  const promise = new Promise<{ url: string; optimizedUrl: string }>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  images.length = 0
  createObjectURL.mockImplementation(() => `blob:upload-${createObjectURL.mock.calls.length}`)
  mocks.fetch.mockResolvedValue({
    url: '/original.webp',
    optimizedUrl: '/optimized.webp',
    mediaAsset: { id: 'media-1' },
  })
  vi.stubGlobal(
    'Image',
    class extends PendingImage {
      constructor() {
        super()
        images.push(this)
      }
    },
  )
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    },
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('file upload resource ownership', () => {
  it('reports an unreadable image, settles processing and releases its preview URL', async () => {
    const wrapper = mountUploader()
    const upload = wrapper.vm.handleFile(file())
    images[0]!.onerror!()
    await upload
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'common.upload.rejected',
        description: 'common.upload.unreadable',
      }),
    )
    expect(wrapper.emitted('processing')).toEqual([[true], [false]])
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
    expect(images[0]!.onload).toBeNull()
    expect(images[0]!.onerror).toBeNull()
  })

  it('uses the delivered preview and revokes the local URL after successful upload', async () => {
    const wrapper = mountUploader()
    const upload = wrapper.vm.handleFile(file())
    images[0]!.onload!()
    await upload
    await flushPromises()
    expect(wrapper.emitted('upload')).toEqual([
      [
        {
          url: '/original.webp',
          optimizedUrl: '/optimized.webp',
          mediaAsset: { id: 'media-1' },
        },
      ],
    ])
    expect(wrapper.get('img').attributes('src')).toBe('/optimized.webp')
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
  })

  it('cancels a previous image decode when a newer file is selected', async () => {
    const wrapper = mountUploader()
    const first = wrapper.vm.handleFile(file('first.png'))
    const oldLoad = images[0]!.onload!
    const second = wrapper.vm.handleFile(file('second.png'))
    images[1]!.onload!()
    oldLoad()
    await Promise.all([first, second])
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect((mocks.fetch.mock.lastCall![1].body as FormData).get('file')).toMatchObject({ name: 'second.png' })
    expect(wrapper.emitted('upload')).toHaveLength(1)
    expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(['blob:upload-1', 'blob:upload-2'])
  })

  it.each(['success', 'failure'] as const)('ignores a canceled request’s late %s', async (outcome) => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = mountUploader()
    const upload = wrapper.vm.handleFile(file())
    images[0]!.onload!()
    await flushPromises()
    await wrapper
      .findAllComponents({ name: 'UButton' })
      .find((button) => button.props('icon') === 'mdi:delete')!
      .trigger('click')
    expect(mocks.fetch.mock.lastCall![1].signal.aborted).toBe(true)
    if (outcome === 'success') pending.resolve({ url: '/stale.webp', optimizedUrl: '/stale-optimized.webp' })
    else pending.reject(new Error('Stale request failed'))
    await upload
    expect(wrapper.emitted('upload')).toEqual([[{ url: '', optimizedUrl: '' }]])
    expect(mocks.toast).not.toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
  })

  it.each(['unmount', 'type', 'image'] as const)('cancels pending upload after %s change', async (action) => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const wrapper = mountUploader()
    const upload = wrapper.vm.handleFile(file())
    images[0]!.onload!()
    await flushPromises()
    if (action === 'unmount') wrapper.unmount()
    else if (action === 'type') await wrapper.setProps({ type: 'client-logo' })
    else await wrapper.setProps({ imageUrl: '/selected-elsewhere.webp' })
    expect(mocks.fetch.mock.lastCall![1].signal.aborted).toBe(true)
    pending.resolve({ url: '/stale.webp', optimizedUrl: '/stale-optimized.webp' })
    await upload
    expect(wrapper.emitted('upload')).toBeUndefined()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
  })

  it('clears decode handlers, timeout and object URL immediately on unmount', async () => {
    vi.useFakeTimers()
    const wrapper = mountUploader()
    const upload = wrapper.vm.handleFile(file())
    expect(vi.getTimerCount()).toBe(1)
    wrapper.unmount()
    await upload
    expect(images[0]!.onload).toBeNull()
    expect(images[0]!.onerror).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
  })

  it('bounds an image decode that never emits load or error', async () => {
    vi.useFakeTimers()
    const wrapper = mountUploader()
    const upload = wrapper.vm.handleFile(file())
    await vi.advanceTimersByTimeAsync(30_000)
    await upload
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'common.upload.unreadable' }))
    expect(vi.getTimerCount()).toBe(0)
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
  })

  it('restores the existing media on current upload failure and does no work while disabled', async () => {
    const wrapper = mountUploader({ disabled: true })
    await wrapper.vm.handleFile(file())
    expect(createObjectURL).not.toHaveBeenCalled()
    await wrapper.setProps({ disabled: false })
    mocks.fetch.mockRejectedValueOnce(new Error('Upload failed'))
    const upload = wrapper.vm.handleFile(file())
    images[0]!.onload!()
    await upload
    expect(wrapper.get('img').attributes('src')).toBe('/initial.webp')
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'common.avatar.uploadError' }))
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:upload-1')
  })
})
