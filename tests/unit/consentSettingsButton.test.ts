import { mount } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ConsentSettingsButton from '../../app/components/ConsentSettingsButton.vue'

const mocks = vi.hoisted(() => ({
  decision: null as ReturnType<typeof shallowRef> | null,
  settingsOpen: null as ReturnType<typeof shallowRef<boolean>> | null,
}))

vi.mock('../../app/composables/useConsent', () => ({
  useConsentDecision: () => mocks.decision,
  useConsentSettingsOpen: () => mocks.settingsOpen,
}))

beforeEach(() => {
  mocks.decision = shallowRef<Record<string, unknown> | null>(null)
  mocks.settingsOpen = shallowRef(false)
})

describe('ConsentSettingsButton', () => {
  it('appears after a decision, opens the shared settings modal, and hides while it is open', async () => {
    const wrapper = mount(ConsentSettingsButton, {
      global: {
        mocks: { $t: (key: string) => key },
        stubs: {
          UTooltip: { template: '<div><slot /></div>' },
          UButton: { emits: ['click'], template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
        },
      },
    })

    expect(wrapper.find('button').exists()).toBe(false)

    mocks.decision!.value = { version: 2 }
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(true)

    await wrapper.find('button').trigger('click')
    expect(mocks.settingsOpen!.value).toBe(true)
    await nextTick()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
