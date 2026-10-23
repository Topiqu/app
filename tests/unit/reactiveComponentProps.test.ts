// @vitest-environment nuxt

import type { MaybeRefOrGetter } from 'vue'

import { shallowRef, toValue } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

import AppLogo from '../../app/components/AppLogo.vue'
import Logout from '../../app/components/Auth/Logout.vue'
import AppConfirmDialog from '../../app/components/AppConfirmDialog.vue'
import LogoUploader from '../../app/components/Form/Client/LogoUploader.vue'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  render: vi.fn(),
  signOut: vi.fn(),
  reset: vi.fn(),
  options: [] as Array<Record<string, MaybeRefOrGetter<number> | MaybeRefOrGetter<string>>>,
}))
mockNuxtImport('useAuth', () => () => ({ signOut: mocks.signOut }))
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))
mockNuxtImport(
  'useAvatarCropper',
  () => (_t: unknown, _onPreview: unknown, options: (typeof mocks.options)[number]) => {
    mocks.options.push(options)
    return {
      acceptFile: vi.fn(),
      chooseFile: vi.fn(),
      cropArea: shallowRef(null),
      draftUrl: shallowRef('blob:draft'),
      errorMessage: shallowRef(''),
      isSwiping: shallowRef(false),
      previewStyle: shallowRef({}),
      render: mocks.render,
      reset: mocks.reset,
      resetCrop: vi.fn(),
      rotation: shallowRef(0),
      zoom: shallowRef(1),
    }
  },
)

const global = {
  mocks: { $t: (key: string) => key },
  stubs: {
    UButton: {
      name: 'UButton',
      props: ['label', 'color', 'square', 'ui', 'loading'],
      template: '<button><slot />{{ label }}</button>',
    },
    UModal: {
      template: '<div><slot name="body" /><slot name="footer" /></div>',
    },
    UIcon: { name: 'UIcon', props: ['name'], template: '<span />' },
    UFormField: { template: '<div><slot /></div>' },
    UFieldGroup: { template: '<div><slot /></div>' },
    UFileUpload: true,
    USlider: true,
    UAlert: true,
    AppMedia: { name: 'AppMedia', props: ['src', 'aspectRatio'], template: '<img :src="src" />' },
    NuxtImg: true,
  },
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.options.length = 0
  mocks.render.mockResolvedValue(new Blob(['rendered'], { type: 'image/webp' }))
  mocks.fetch.mockResolvedValue({ url: '/image.webp', optimizedUrl: '/optimized.webp' })
})

describe('reactive destructured component props', () => {
  it('keeps AppLogo defaults independent and reacts to parent alt changes', async () => {
    const first = mount(AppLogo)
    const second = mount(AppLogo, { props: { alt: 'Druhé logo' } })
    expect(first.get('img').attributes('alt')).toBe('Topiqu')
    await second.setProps({ alt: 'Nový popis' })
    expect(second.findAll('img').map((image) => image.attributes('alt'))).toEqual(['Nový popis', 'Nový popis'])
    expect(first.get('img').attributes('alt')).toBe('Topiqu')
  })

  it('updates confirm labels, color and icons when parent options change', async () => {
    const wrapper = mount(AppConfirmDialog, { props: { message: 'Původní zpráva' }, global })
    expect(wrapper.getComponent({ name: 'UButton' }).props('label')).toBe('OK')
    expect(wrapper.getComponent({ name: 'UButton' }).props('color')).toBe('primary')
    await wrapper.setProps({ message: 'Nová zpráva', variant: 'danger', confirmText: 'Smazat' })
    expect(wrapper.text()).toContain('Nová zpráva')
    expect(wrapper.getComponent({ name: 'UButton' }).props('color')).toBe('error')
    expect(wrapper.getComponent({ name: 'UIcon' }).props('name')).toBe('mdi:alert-outline')
    await wrapper.setProps({ variant: 'success', icon: 'mdi:star', confirmText: undefined })
    expect(wrapper.getComponent({ name: 'UButton' }).props('label')).toBe('OK')
    expect(wrapper.getComponent({ name: 'UButton' }).props('color')).toBe('success')
    expect(wrapper.getComponent({ name: 'UIcon' }).props('name')).toBe('mdi:star')
  })

  it('updates the logout label and button shape when its parent changes showLabel', async () => {
    const wrapper = mount(Logout, { global })
    const button = wrapper.getComponent({ name: 'UButton' })
    expect(button.props('square')).toBe(true)
    expect(button.props('label')).toBeUndefined()
    await wrapper.setProps({ showLabel: true })
    expect(button.props('square')).toBe(false)
    expect(button.props('label')).toBe('common.auth.logout')
    await button.trigger('click')
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: window.location.origin })
  })

  it('updates brand preview and output dimensions while retaining independent per-instance defaults', async () => {
    const first = mount(LogoUploader, { props: { imageUrl: '/logo.webp' }, global })
    const second = mount(LogoUploader, { props: { imageUrl: '/favicon.webp', assetType: 'favicon' }, global })
    expect(first.getComponent({ name: 'AppMedia' }).props('aspectRatio')).toBe('16 / 5')
    expect(second.getComponent({ name: 'AppMedia' }).props('aspectRatio')).toBe('1 / 1')
    expect(toValue(mocks.options[0]!.outputWidth)).toBe(1280)
    expect(toValue(mocks.options[1]!.outputWidth)).toBe(256)
    await first.setProps({ imageUrl: '/new-favicon.webp', assetType: 'favicon' })
    expect(first.getComponent({ name: 'AppMedia' }).props()).toMatchObject({
      src: '/new-favicon.webp',
      aspectRatio: '1 / 1',
    })
    expect(toValue(mocks.options[0]!.outputWidth)).toBe(256)
    expect(toValue(mocks.options[0]!.outputHeight)).toBe(256)
  })

  it('does not start an upload when the asset type changes during rendering', async () => {
    let finishRender!: (blob: Blob) => void
    mocks.render.mockReturnValueOnce(new Promise<Blob>((resolve) => (finishRender = resolve)))
    const wrapper = mount(LogoUploader, { props: { imageUrl: '/logo.webp' }, global })
    const save = wrapper.findAll('button').find((button) => button.text() === 'common.preferences.companyLogo.save')!
    await save.trigger('click')
    await save.trigger('click')
    expect(mocks.render).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ assetType: 'favicon' })
    finishRender(new Blob(['logo'], { type: 'image/webp' }))
    await flushPromises()
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(wrapper.emitted('upload')).toBeUndefined()
  })

  it.each(['change', 'unmount'] as const)('cancels and fences an upload on asset %s', async (action) => {
    let finishUpload!: (result: { url: string; optimizedUrl: string }) => void
    mocks.fetch.mockReturnValueOnce(new Promise((resolve) => (finishUpload = resolve)))
    const wrapper = mount(LogoUploader, { props: { imageUrl: '/logo.webp' }, global })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'common.preferences.companyLogo.save')!
      .trigger('click')
    await flushPromises()
    const options = mocks.fetch.mock.lastCall![1]
    expect(options.body.get('type')).toBe('client-logo')
    expect(options.body.get('maxWidth')).toBe('1280')
    expect(options.body.get('maxHeight')).toBe('400')
    if (action === 'change') await wrapper.setProps({ assetType: 'favicon' })
    else wrapper.unmount()
    expect(options.signal.aborted).toBe(true)
    finishUpload({ url: '/old-logo.webp', optimizedUrl: '/old-optimized-logo.webp' })
    await flushPromises()
    expect(wrapper.emitted('upload')).toBeUndefined()
  })
})
