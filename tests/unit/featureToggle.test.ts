// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import FeatureToggle from '../../app/components/Form/Client/FeatureToggle.vue'

const props = {
  icon: 'mdi:robot-outline',
  title: 'AI',
  description: 'Generation',
  price: null,
  billingPlan: 'MONTHLY' as const,
  enabled: false,
}
const global = { mocks: { $t: (key: string) => key } }

describe('feature toggle card', () => {
  it('toggles once from a click anywhere on the card and names the switch after the feature', async () => {
    const wrapper = await mountSuspended(FeatureToggle, { props, global, attachTo: document.body })
    const control = wrapper.get('[role="switch"]')
    expect(control.attributes('aria-label')).toBe('AI')
    await wrapper.get('label').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
    wrapper.unmount()
  })

  it('does not toggle a disabled feature', async () => {
    const wrapper = await mountSuspended(FeatureToggle, { props: { ...props, disabled: true }, global })
    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })
})
