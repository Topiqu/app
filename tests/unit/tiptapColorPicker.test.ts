// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import TiptapColorPicker from '../../app/components/Tiptap/ColorPicker.vue'

const PopoverStub = defineComponent({
  name: 'UPopover',
  props: { open: Boolean },
  emits: ['update:open'],
  template: '<div><slot /><slot name="content" /></div>',
})

const ColorInputStub = defineComponent({
  name: 'UColorPicker',
  props: { modelValue: String, throttle: Number },
  emits: ['update:modelValue'],
  template: '<div data-slot="picker"><div data-slot="selector" /></div>',
})

const mountPicker = () =>
  mount(TiptapColorPicker, {
    props: { modelValue: '#111111' },
    attachTo: document.body,
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UPopover: PopoverStub,
        UColorPicker: ColorInputStub,
        UButton: { template: '<button><slot /></button>' },
        UFormField: { template: '<div><slot /></div>' },
        USeparator: true,
      },
    },
  })

describe('Tiptap color picker', () => {
  it('keeps color changes local during a drag and commits the final color on release', async () => {
    const wrapper = mountPicker()
    wrapper.getComponent(PopoverStub).vm.$emit('update:open', true)
    await nextTick()

    const picker = wrapper.getComponent(ColorInputStub)
    const pickerElement = picker.element
    const pointerdown = new Event('pointerdown', { bubbles: true, cancelable: true })
    wrapper.get('[data-slot="selector"]').element.dispatchEvent(pointerdown)
    expect(pointerdown.defaultPrevented).toBe(true)
    picker.vm.$emit('update:modelValue', '#224466')
    picker.vm.$emit('update:modelValue', '#4488cc')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(picker.element).toBe(pickerElement)
    expect(wrapper.text()).toContain('#4488CC')

    window.dispatchEvent(new Event('pointerup'))
    await nextTick()
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['#4488cc']])
    wrapper.unmount()
  })

  it('commits a pending color if the popover closes before pointer release', async () => {
    const wrapper = mountPicker()
    const popover = wrapper.getComponent(PopoverStub)
    popover.vm.$emit('update:open', true)
    await nextTick()
    wrapper.getComponent(ColorInputStub).vm.$emit('update:modelValue', '#abcdef')
    popover.vm.$emit('update:open', false)
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['#abcdef']])
    wrapper.unmount()
  })
})
