import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import ConsentSettings from '../../app/components/ConsentSettings.vue'
import { consentCapabilities, createConsentDecision } from '../../shared/utils/consent'

mockNuxtImport('useLocalePath', () => () => (path: string) => path)
mockNuxtImport('useI18n', () => () => ({ t: (key: string) => key }))

const render = (
  site: { plan: string; allowGtag?: boolean; gtagId?: string; gamNetworkCode?: string },
  granted = false,
) => {
  const capabilities = consentCapabilities(site)
  return mount(ConsentSettings, {
    props: {
      open: true,
      site,
      capabilities,
      decision: granted ? createConsentDecision(capabilities, { analytics: true, marketing: true }) : null,
    },
    global: {
      mocks: { $t: (key: string, params?: { names: string }) => params?.names ?? key },
      stubs: {
        UModal: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
        UButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
        USwitch: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
        },
        NuxtLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('cookie settings choices', () => {
  it('only lists services used by the website and starts optional categories off', () => {
    const wrapper = render({ plan: 'PRO' })
    expect(wrapper.text()).toContain('common.consent.internalAnalytics')
    expect(wrapper.text()).not.toContain('Google Analytics 4')
    expect(wrapper.text()).not.toContain('Google AdSense')
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect((wrapper.get('input').element as HTMLInputElement).checked).toBe(false)
    wrapper.unmount()
  })
  it('keeps BASIC to analytics only because Google CMP owns AdSense consent', () => {
    const wrapper = render({ plan: 'BASIC' })
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Google AdSense')
    wrapper.unmount()
  })
  it('shows GA4 and the actual advertising service and saves the selected categories', async () => {
    const wrapper = render({ plan: 'PRO', allowGtag: true, gtagId: 'G-ONE123', gamNetworkCode: '123' })
    expect(wrapper.text()).toContain('Google Analytics 4')
    expect(wrapper.text()).toContain('Google Ad Manager')
    await wrapper.get('#consent-marketing').setValue(true)
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('save')?.[0]).toEqual([{ analytics: false, marketing: true }])
    wrapper.unmount()
  })
  it('restores a saved choice and offers equally available accept and reject actions', async () => {
    const wrapper = render({ plan: 'PRO', gamNetworkCode: '123' }, true)
    expect(wrapper.text()).toContain('Google Ad Manager')
    expect(wrapper.findAll('input').every((input) => (input.element as HTMLInputElement).checked)).toBe(true)
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('reject')).toHaveLength(1)
    await wrapper.findAll('button')[2]!.trigger('click')
    expect(wrapper.emitted('accept')).toHaveLength(1)
    wrapper.unmount()
  })
})
