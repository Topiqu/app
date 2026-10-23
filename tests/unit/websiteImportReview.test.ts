// @vitest-environment nuxt
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WebsiteImportView } from '../../shared/utils/websiteImport'

import Review from '../../app/components/WebsiteImport/Review.vue'
import { emptyWebsiteValues } from '../../shared/utils/websiteImport'

const permissions = vi.hoisted(() => ({ socials: true }))
mockNuxtImport('useTenantScope', () => () => (scope: string) => scope !== 'INTEGRATION_CONTROL' || permissions.socials)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const Checkbox = defineComponent({
  props: ['modelValue', 'label', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit }) =>
    () =>
      h('label', [
        h('input', {
          type: 'checkbox',
          checked: props.modelValue,
          disabled: props.disabled,
          onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).checked),
        }),
        props.label,
      ]),
})
const Input = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit, attrs }) =>
    () =>
      h('input', {
        ...attrs,
        value: props.modelValue,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
})
const Button = defineComponent({
  props: ['label', 'disabled', 'type'],
  setup:
    (props, { attrs }) =>
    () =>
      h('button', { ...attrs, type: props.type ?? 'button', disabled: props.disabled }, props.label),
})
const fixture = (): WebsiteImportView => ({
  id: 'import-1',
  sourceUrl: 'https://firma.cz/',
  status: 'READY',
  errorCode: null,
  acceptedFields: [],
  expected: {},
  current: { ...emptyWebsiteValues(), focus: 'Current human focus', language: 'en' },
  result: {
    values: {
      ...emptyWebsiteValues(),
      focus: 'Výběrová káva a domácí příprava.',
      audience: 'Začínající domácí baristé.',
      keywords: ['káva', 'espresso'],
      language: 'cs',
    },
    sources: [{ url: 'https://firma.cz/', title: 'Company' }],
    warnings: [],
  },
  knowledge: [{ id: 'source-1', title: 'Company', sourceUrl: 'https://firma.cz/', status: 'PENDING' }],
})
const render = (job = fixture(), disabled = false) =>
  mount(Review, {
    props: { job, disabled },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UCheckbox: Checkbox,
        UInput: Input,
        UTextarea: Input,
        UInputTags: true,
        USelect: true,
        UButton: Button,
        UAlert: true,
        AppMedia: true,
      },
    },
  })

beforeEach(() => {
  permissions.socials = true
})

describe('website suggestions review', () => {
  it('accepts only the checked field and preserves edits in its submitted value', async () => {
    const job = fixture()
    const wrapper = render(job)
    const field = wrapper.get('[data-website-field="focus"]')
    await field.get('input:not([type="checkbox"])').setValue('Upravené zaměření blogu')
    await field.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('apply')?.[0]).toEqual([
      ['focus'],
      expect.objectContaining({ focus: 'Upravené zaměření blogu' }),
    ])
    expect(job.result?.values.focus).toBe('Výběrová káva a domácí příprava.')
  })
  it('accepts all available fields including Knowledge without inventing missing assets', async () => {
    const wrapper = render()
    const button = wrapper.findAll('button').find((item) => item.text() === 'common.websiteImport.allCorrect')!
    await button.trigger('click')
    expect(wrapper.emitted('apply')?.[0]?.[0]).toEqual(['keywords', 'focus', 'audience', 'language', 'knowledge'])
  })
  it('allows an empty field to be edited again instead of removing its input', async () => {
    const wrapper = render()
    const field = wrapper.get('[data-website-field="focus"]')
    await field.get('input:not([type="checkbox"])').setValue('')
    expect(field.find('input:not([type="checkbox"])').exists()).toBe(true)
    await field.get('input:not([type="checkbox"])').setValue('Nové zaměření')
    expect((field.get('input:not([type="checkbox"])').element as HTMLInputElement).value).toBe('Nové zaměření')
  })
  it('excludes socials from accept-all without integration permission', async () => {
    permissions.socials = false
    const job = fixture()
    job.result!.values.socials = [{ platform: 'LINKEDIN', url: 'https://linkedin.com/company/firma' }]
    const wrapper = render(job)
    expect(wrapper.get('[data-website-field="socials"] input[type="checkbox"]').attributes('disabled')).toBeDefined()
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'common.websiteImport.allCorrect')!
      .trigger('click')
    expect(wrapper.emitted('apply')?.[0]?.[0]).not.toContain('socials')
  })
  it('disables accepting suggestions while other settings have unsaved edits', () => {
    const wrapper = render(fixture(), true)
    for (const button of wrapper.findAll('button')) expect(button.attributes('disabled')).toBeDefined()
  })
})
