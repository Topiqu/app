import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, reactive, Suspense } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

import AddSource from '../../app/components/Knowledge/AddSource.vue'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: { add: vi.fn() } }))
mockNuxtImport('useClientSite', () => async () => null)
mockNuxtImport('useToast', () => () => mocks.toast)
mockNuxtImport('$fetch', () => mocks.fetch)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const Modal = defineComponent({
  props: ['open'],
  setup:
    (_props, { slots }) =>
    () =>
      h('section', [slots.body?.(), slots.footer?.()]),
})
const Input = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
})
const Consent = defineComponent({
  props: ['confirmed'],
  emits: ['update:confirmed'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        type: 'checkbox',
        checked: props.confirmed,
        onChange: (event: Event) => emit('update:confirmed', (event.target as HTMLInputElement).checked),
      }),
})
const mountDialog = async (initialUrl?: string, initiallyOpen = false) => {
  const state = reactive<{ initialUrl?: string | null; open: boolean }>({ initialUrl, open: initiallyOpen })
  const wrapper = mount(
    defineComponent({
      render: () =>
        h(Suspense, null, {
          default: () =>
            h(AddSource, {
              ...state,
              'onUpdate:open': (open: boolean) => {
                state.open = open
              },
            }),
        }),
    }),
    {
      global: {
        renderStubDefaultSlot: true,
        mocks: { $t: (key: string) => key },
        stubs: {
          UModal: Modal,
          UInput: Input,
          UTextarea: true,
          UButton: { template: '<button><slot /></button>' },
          UFormField: true,
          UTabs: true,
          URadioGroup: true,
          UProgress: true,
          UIcon: true,
          AddSourceSettings: true,
          AddSourceConsent: Consent,
        },
      },
    },
  )
  await flushPromises()
  const dialog = wrapper.getComponent(AddSource)
  state.open = true
  await flushPromises()
  return { wrapper, dialog, state }
}

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetch.mockResolvedValue({ urls: ['https://firma.cz/about'], found: 1, existing: 0, quotaLeft: 50 })
})

describe('company website knowledge import', () => {
  it('keeps a pending discovery from being submitted twice or closed by its cancel action', async () => {
    let finish!: (value: unknown) => void
    mocks.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { wrapper } = await mountDialog('https://firma.cz/')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    const cancel = wrapper.findAll('button').find((button) => button.text() === 'knowledge.cancel')!
    expect(cancel.attributes('disabled')).toBeDefined()
    finish({ urls: [], found: 0, existing: 0, quotaLeft: 50 })
    await flushPromises()
    expect(cancel.attributes('disabled')).toBeUndefined()
  })

  it.each([
    ['https://firma.cz/', false],
    ['https://firma.cz/', true],
    ['http://firma.cz/', false],
  ] as const)('prefills a whole-site import without fetching %s (initially open: %s)', async (url, open) => {
    const { wrapper } = await mountDialog(url, open)
    expect((wrapper.get('input[inputmode="url"]').element as HTMLInputElement).value).toBe('https://firma.cz/')
    expect(wrapper.getComponent({ name: 'UTabs' }).props('modelValue')).toBe('URL')
    expect(wrapper.getComponent({ name: 'URadioGroup' }).props('modelValue')).toBe('SITE')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('requires confirmation, discovers pages and imports through the regular source endpoint', async () => {
    const { wrapper, dialog } = await mountDialog('https://firma.cz/')
    await wrapper.get('form').trigger('submit')
    expect(mocks.fetch).not.toHaveBeenCalled()

    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/knowledge/sitemap', {
      method: 'POST',
      body: { url: 'https://firma.cz/' },
    })

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const creation = mocks.fetch.mock.calls.find(([path]) => path === '/api/knowledge')!
    expect(creation[1].body.get('url')).toBe('https://firma.cz/about')
    expect(creation[1].body.get('kind')).toBe('URL')
    expect(creation[1].body.get('confirmed')).toBe('true')
    expect(dialog.emitted('created')).toHaveLength(1)
    expect(dialog.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('clears the website and confirmation before a generic Add action', async () => {
    const { wrapper, state } = await mountDialog('https://firma.cz/')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    state.open = false
    await nextTick()
    state.initialUrl = null
    state.open = true
    await nextTick()
    expect(wrapper.getComponent({ name: 'UTabs' }).props('modelValue')).toBe('NOTE')
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
