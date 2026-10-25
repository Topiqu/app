// @vitest-environment nuxt

import { nextTick, shallowRef } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import UnsavedBar from '../../app/components/UnsavedBar.vue'

const height = shallowRef(96)
mockNuxtImport('useElementSize', () => () => ({ height }))
enableAutoUnmount(afterEach)

describe('unsaved settings bar', () => {
  it('keeps actions visible, reserves the measured height and clears it on unmount', async () => {
    const wrapper = await mountSuspended(UnsavedBar, {
      props: { dirty: true },
      global: { stubs: { Teleport: true }, mocks: { $t: (key: string) => key } },
    })
    expect(wrapper.get('[data-unsaved-bar]').attributes('role')).toBe('status')
    expect(document.documentElement.style.getPropertyValue('--topiqu-unsaved-bar-height')).toBe('112px')
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('reset')).toHaveLength(1)
    expect(wrapper.emitted('save')).toHaveLength(1)
    height.value = 144
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--topiqu-unsaved-bar-height')).toBe('160px')
    await wrapper.setProps({ loading: true })
    expect(wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
    wrapper.unmount()
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--topiqu-unsaved-bar-height')).toBe('0px')
  })
})
