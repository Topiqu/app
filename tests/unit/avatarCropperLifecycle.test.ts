// @vitest-environment nuxt

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAvatarCropper } from '../../app/composables/useAvatarCropper'

class PendingImage {
  naturalWidth = 1600
  naturalHeight = 500
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ''
}
const images: PendingImage[] = []
const revokeObjectURL = vi.fn()
let objectUrlId = 0

const setup = () => {
  let cropper!: ReturnType<typeof useAvatarCropper>
  const dimensions = shallowRef({ viewportWidth: 336, viewportHeight: 105, outputWidth: 1280, outputHeight: 400 })
  const preview = vi.fn()
  const wrapper = mount(
    defineComponent({
      setup() {
        cropper = useAvatarCropper((key) => key, preview, {
          viewportWidth: () => dimensions.value.viewportWidth,
          viewportHeight: () => dimensions.value.viewportHeight,
          outputWidth: () => dimensions.value.outputWidth,
          outputHeight: () => dimensions.value.outputHeight,
          fit: 'contain',
        })
        return () => h('div', { ref: 'cropArea' })
      },
    }),
  )
  return { wrapper, cropper, dimensions, preview }
}
const file = (name = 'image.png') => new File(['image'], name, { type: 'image/png' })
const accept = async (cropper: ReturnType<typeof useAvatarCropper>, name?: string) => {
  cropper.acceptFile(file(name))
  await nextTick()
  return images.at(-1)!
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  images.length = 0
  objectUrlId = 0
  revokeObjectURL.mockClear()
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
      static createObjectURL = () => `blob:cropper-${++objectUrlId}`
      static revokeObjectURL = revokeObjectURL
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('avatar cropper resource ownership', () => {
  it('ignores stale image success and failure after a new file is selected', async () => {
    const { cropper, preview } = setup()
    const first = await accept(cropper, 'first.png')
    const oldLoad = first.onload!
    const oldError = first.onerror!
    const second = await accept(cropper, 'second.png')
    second.onload!()
    oldLoad()
    oldError()

    expect(cropper.draftUrl.value).toBe('blob:cropper-2')
    expect(cropper.errorMessage.value).toBe('')
    expect(preview.mock.lastCall).toEqual(['blob:cropper-2'])
    expect(first.onload).toBeNull()
    expect(first.onerror).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cropper-1')
  })

  it('cannot render an old image while a replacement is still loading', async () => {
    const { cropper } = setup()
    const first = await accept(cropper)
    first.onload!()
    cropper.acceptFile(file('replacement.png'))

    await expect(cropper.render()).rejects.toThrow('common.avatar.invalidFile')
  })

  it('releases image handlers and object URLs on reset and unmount', async () => {
    const { cropper, preview, wrapper } = setup()
    const first = await accept(cropper)
    const staleLoad = first.onload!
    cropper.reset()
    await nextTick()
    staleLoad()
    expect(preview.mock.lastCall).toEqual([null])
    expect(cropper.previewStyle.value).toEqual({})
    expect(first.onload).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cropper-1')

    const second = await accept(cropper)
    const pendingLoad = second.onload!
    const previewCount = preview.mock.calls.length
    wrapper.unmount()
    pendingLoad()
    expect(preview).toHaveBeenCalledTimes(previewCount)
    expect(second.onload).toBeNull()
    expect(second.onerror).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cropper-2')
  })

  it('handles a current image failure without leaving a usable previous image', async () => {
    const { cropper } = setup()
    const image = await accept(cropper)
    image.onerror!()
    await nextTick()

    expect(cropper.errorMessage.value).toBe('common.avatar.invalidFile')
    expect(cropper.draftUrl.value).toBeUndefined()
    await expect(cropper.render()).rejects.toThrow('common.avatar.invalidFile')
  })

  it('uses changed frame and output dimensions when switching from logo to favicon', async () => {
    const { cropper, dimensions } = setup()
    const context = { translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const sizes: number[][] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
      sizes.push([this.width, this.height])
      callback(new Blob(['rendered'], { type: 'image/webp' }))
    })
    const image = await accept(cropper)
    image.onload!()
    expect(cropper.previewStyle.value.transform).toContain('scale(0.21)')
    await cropper.render()

    dimensions.value = { viewportWidth: 288, viewportHeight: 288, outputWidth: 256, outputHeight: 256 }
    await nextTick()
    expect(cropper.previewStyle.value.transform).toContain('scale(0.18)')
    await cropper.render()
    expect(sizes).toEqual([
      [1280, 400],
      [256, 256],
    ])
    expect(context.scale).toHaveBeenLastCalledWith(0.16, 0.16)
  })
})
