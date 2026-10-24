// @vitest-environment nuxt

import { defineComponent, h, shallowRef } from 'vue'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Widgets from '../../app/components/Form/Client/Widgets.vue'

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))
const data = shallowRef({ widgets: [] as Array<Record<string, unknown>>, allowed: ['DIVIDER'] })
mockNuxtImport('useConfirm', () => () => mocks.confirm)
mockNuxtImport('useI18n', () => () => ({
  t: (key: string, values?: unknown) => `${key}${values ? JSON.stringify(values) : ''}`,
}))
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))
mockNuxtImport('useLiveClientSite', () => async () => shallowRef({ currency: 'EUR' }))
mockNuxtImport('useClientSiteStatus', () => async () => ({ data: shallowRef(null) }))
mockNuxtImport('useQuery', () => () => ({ data, isPending: shallowRef(false), refetch: vi.fn() }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.confirm.mockResolvedValue(false)
  data.value = {
    allowed: ['DIVIDER'],
    widgets: ['first', 'second'].map((id) => ({
      id,
      kind: 'DIVIDER',
      slot: 'HOME_TOP',
      active: true,
      languages: [],
      config: { style: 'line', label: id },
    })),
  }
})

const Slideover = defineComponent({
  props: ['open'],
  setup:
    (props, { slots }) =>
    () =>
      props.open ? h('section', { 'data-widget-editor': '' }, [slots.body?.(), slots.footer?.()]) : null,
})
const mountWidgets = () =>
  mountSuspended(Widgets, {
    global: {
      stubs: {
        USlideover: Slideover,
        FormClientWidgetLibrary: true,
        FormClientWidgetPlacement: true,
        FormClientWidgetThumb: true,
        FormClientWidgetPreview: true,
        FormClientWidgetDivider: true,
      },
    },
  })

describe('widget deletion', () => {
  it('keeps the widget when deletion is cancelled', async () => {
    const wrapper = await mountWidgets()
    await wrapper.get('[data-widget-key="first"] button[aria-label="Delete"]').trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'widgets.deleteTitle',
        message: 'widgets.deleteConfirm{"name":"first"}',
        confirmText: 'common.actions.delete',
        cancelText: 'common.actions.cancel',
        variant: 'danger',
      }),
    )
    expect(wrapper.findAll('[data-widget-key]')).toHaveLength(2)
  })

  it('confirms deletion from the widget editor and closes it after approval', async () => {
    const wrapper = await mountWidgets()
    await wrapper.get('[data-widget-key="first"] button[aria-label="Edit first"]').trigger('click')
    expect(wrapper.find('[data-widget-editor]').exists()).toBe(true)
    mocks.confirm.mockResolvedValueOnce(true)
    const remove = wrapper
      .get('[data-widget-editor]')
      .findAll('button')
      .find((button) => button.text() === 'Delete')!
    await remove.trigger('click')
    await flushPromises()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-widget-key="first"]').exists()).toBe(false)
    expect(wrapper.find('[data-widget-key="second"]').exists()).toBe(true)
    expect(wrapper.find('[data-widget-editor]').exists()).toBe(false)
  })

  it('removes the confirmed widget by identity if the list changes while the dialog is open', async () => {
    let answer!: (value: boolean) => void
    mocks.confirm.mockImplementationOnce(() => new Promise<boolean>((resolve) => (answer = resolve)))
    const wrapper = await mountWidgets()
    await wrapper.get('[data-widget-key="first"] button[aria-label="Delete"]').trigger('click')
    await wrapper.get('[data-widget-key="first"] button[aria-label="Move later"]').trigger('click')
    answer(true)
    await flushPromises()
    expect(wrapper.find('[data-widget-key="first"]').exists()).toBe(false)
    expect(wrapper.find('[data-widget-key="second"]').exists()).toBe(true)
  })
})
