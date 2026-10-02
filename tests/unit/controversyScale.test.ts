// @vitest-environment nuxt
import { createI18n } from 'vue-i18n'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ControversyScale from '../../app/components/Form/Client/ControversyScale.vue'

const mounted: Array<{ unmount: () => void }> = []
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
const mountScale = async (modelValue?: string) => {
  const wrapper = await mountSuspended(ControversyScale, {
    props: modelValue === undefined ? {} : { modelValue },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })] },
  })
  mounted.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  vi.unstubAllGlobals()
})

describe('controversy scale', () => {
  it('starts at zero without changing an unset preference', async () => {
    const wrapper = await mountScale()
    const slider = wrapper.get('[role="slider"]')
    expect(slider.attributes('aria-valuenow')).toBe('0')
    expect(slider.attributes('aria-valuemin')).toBe('0')
    expect(slider.attributes('aria-valuemax')).toBe('3')
    expect(slider.attributes('aria-labelledby')).toBeTruthy()
    expect(slider.attributes('aria-valuetext')).toContain('0:')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it.each([
    ['', 0],
    ['NONE', 0],
    ['LOW', 1],
    ['MEDIUM', 2],
    ['HIGH', 3],
  ] as const)('loads %s as tier %i and fills the corresponding share of the bar', async (level, tier) => {
    const wrapper = await mountScale(level)
    expect(wrapper.get('[role="slider"]').attributes('aria-valuenow')).toBe(String(tier))
    const range = wrapper.findComponent({ name: 'SliderRange' }).element as HTMLElement
    expect(100 - parseFloat(range.style.right)).toBeCloseTo((tier / 3) * 100)
  })

  it('lets the user select a tier directly and return to zero', async () => {
    const wrapper = await mountScale()
    const choices = wrapper.findAll('button')
    await choices[3]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['HIGH'])
    await wrapper.setProps({ modelValue: 'HIGH' })
    expect(choices[3]!.attributes('aria-pressed')).toBe('true')
    await choices[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['NONE'])
  })

  it('moves between tiers with arrow keys and supports Home and End', async () => {
    const wrapper = await mountScale()
    const slider = wrapper.get('[role="slider"]')
    await slider.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['LOW'])
    await wrapper.setProps({ modelValue: 'LOW' })
    await slider.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['HIGH'])
    await wrapper.setProps({ modelValue: 'HIGH' })
    await slider.trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['NONE'])
  })
})
