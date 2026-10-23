// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import Password from '../../app/components/User/Password.vue'

const strong = 'L7!n2Q$w9vR#4tY@8uZ%'
const mountPassword = (modelValue = '') =>
  mountSuspended(Password, {
    props: { modelValue },
    shallow: true,
    global: { renderStubDefaultSlot: true, mocks: { $t: (key: string) => key } },
  })
enableAutoUnmount(afterEach)

describe('password strength factory integration', () => {
  it('reactively updates weak and strong feedback using the installed estimator', async () => {
    const wrapper = await mountPassword('aaaa')
    expect(wrapper.findComponent({ name: 'UProgress' }).props('modelValue')).toBeLessThanOrEqual(1)
    expect(wrapper.findComponent({ name: 'UInput' }).props('color')).toBe('error')
    expect(wrapper.text()).toContain('Weak')
    await wrapper.setProps({ modelValue: strong })
    expect(wrapper.findComponent({ name: 'UProgress' }).props('modelValue')).toBeGreaterThanOrEqual(3)
    expect(wrapper.findComponent({ name: 'UInput' }).props('color')).toBe('success')
    expect(wrapper.text()).toContain('Very strong')
    await wrapper.setProps({ modelValue: 'aaaa' })
    expect(wrapper.findComponent({ name: 'UInput' }).props('color')).toBe('error')
  })

  it('preserves external validity, length constraints, confirmation and input privacy', async () => {
    const wrapper = await mountPassword(strong)
    await wrapper.setProps({ isValid: false })
    expect(wrapper.findComponent({ name: 'UInput' }).props('color')).toBe('error')
    await wrapper.setProps({ isValid: true, maxLength: 10 })
    expect(wrapper.text()).toContain('Password is too long. (max. 10 characters)')
    expect(wrapper.findComponent({ name: 'UInput' }).props('color')).toBe('error')
    await wrapper.setProps({ minLength: 30, maxLength: 124 })
    expect(wrapper.text()).toContain('Password is too short. (min. 30 characters)')
    await wrapper.setProps({ isConfirm: true })
    expect(wrapper.findComponent({ name: 'UProgress' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'UInput' }).props('type')).toBe('password')
    expect(wrapper.text()).not.toContain(strong)
  })
})
