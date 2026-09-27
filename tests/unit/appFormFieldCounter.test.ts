// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import AppFormField from '../../app/components/AppFormField.vue'

enableAutoUnmount(afterEach)

const mount = (props: Record<string, unknown>) => mountSuspended(AppFormField, { props: { label: 'Bio', ...props } })

describe('AppFormField character counter', () => {
  it('counts a textarea against its limit', async () => {
    const wrapper = await mount({ type: 'textarea', maxLength: 300, modelValue: 'Hello' })

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('300')
    expect(wrapper.text()).toContain('5/300')
  })

  it('turns the counter to a warning near the limit', async () => {
    const wrapper = await mount({ type: 'textarea', maxLength: 10, modelValue: '123456789' })

    expect(wrapper.find('.text-warning').text()).toBe('9/10')
  })

  it('shows no counter on a single-line input or an unbounded textarea', async () => {
    const input = await mount({ maxLength: 300, modelValue: 'Hello' })
    const textarea = await mount({ type: 'textarea', modelValue: 'Hello' })

    expect(input.text()).not.toContain('/300')
    expect(textarea.text()).not.toMatch(/\d+\/\d+/)
  })
})
