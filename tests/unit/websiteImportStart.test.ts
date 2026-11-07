// @vitest-environment nuxt
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Start from '../../app/components/WebsiteImport/Start.vue'

const start = vi.hoisted(() => vi.fn())
mockNuxtImport('useWebsiteImport', () => () => ({ start }))
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const Field = defineComponent({
  name: 'UFormField',
  props: ['label', 'error'],
  setup:
    (props, { slots }) =>
    () =>
      h('div', [slots.default?.(), props.error ? h('p', props.error) : null]),
})
const Input = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        value: props.modelValue,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
})
const Checkbox = defineComponent({
  props: ['modelValue', 'label', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('input', {
        type: 'checkbox',
        checked: props.modelValue,
        onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
      }),
})
const Button = defineComponent({
  props: ['label', 'disabled', 'type', 'loading'],
  setup: (props) => () => h('button', { type: props.type, disabled: props.disabled }, props.label),
})
const render = (initialUrl?: string) =>
  mount(Start, {
    props: { initialUrl },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { UFormField: Field, UInput: Input, UCheckbox: Checkbox, UButton: Button },
    },
  })

beforeEach(() => {
  start.mockReset()
  start.mockResolvedValue(undefined)
})

describe('website import start', () => {
  it('starts only after the processing confirmation', async () => {
    const wrapper = render('https://firma.cz/')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    await wrapper.find('form').trigger('submit')
    expect(start).not.toHaveBeenCalled()

    await wrapper.find('input[type="checkbox"]').setValue(true)
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(start).toHaveBeenCalledExactlyOnceWith('https://firma.cz/')
  })

  it('rejects an address the server would refuse before sending it', async () => {
    const wrapper = render()
    await wrapper.find('input:not([type])').setValue('localhost')
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    expect(start).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('common.websiteImport.start.invalidUrl')
  })

  it.each([
    ['WEBSITE_IMPORT_ACTIVE', 409, 'common.websiteImport.start.active'],
    ['WEBSITE_IMPORT_LIMIT', 429, 'common.websiteImport.start.limit'],
    ['AI_PLAN_REQUIRED', 403, 'common.websiteImport.start.aiPlanRequired'],
    ['AI_ALLOWANCE_EXHAUSTED', 402, 'common.websiteImport.start.allowanceExhausted'],
    [undefined, 429, 'common.websiteImport.rateLimited'],
    [undefined, 500, 'common.websiteImport.start.failed'],
  ])('explains a %s refusal', async (code, statusCode, message) => {
    start.mockRejectedValueOnce({ statusCode, data: { statusCode, data: code ? { code } : undefined } })
    const wrapper = render(' firma.cz ')
    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(start).toHaveBeenCalledWith('firma.cz')
    expect(wrapper.text()).toContain(message)
  })
})
