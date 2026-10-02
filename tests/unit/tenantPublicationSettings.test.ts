// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import Community from '../../app/components/Form/Client/Community.vue'
import { publicationChannelSettings } from '../../shared/utils/publicationChannels'
import PublicationChannels from '../../app/components/Form/Client/PublicationChannels.vue'

mockNuxtImport('useShopify', () => () => ({ data: shallowRef(null) }))
mockNuxtImport('useLocalePath', () => () => () => '/settings?tab=integrations')

const global = { mocks: { $t: (key: string) => key } }

describe('tenant publication settings', () => {
  it('keeps the comments and GIF switches independent', async () => {
    const wrapper = await mountSuspended(Community, {
      props: { commentsEnabled: false, commentGifsEnabled: true },
      global,
    })
    const switches = wrapper.findAll('[role="switch"]')
    expect(switches[0]!.attributes('aria-checked')).toBe('false')
    expect(switches[1]!.attributes('aria-checked')).toBe('true')
    await switches[1]!.trigger('click')
    expect(wrapper.emitted('update:commentGifsEnabled')?.at(-1)).toEqual([false])
    expect(wrapper.emitted('update:commentsEnabled')).toBeUndefined()
  })

  it('offers only destinations managed by Topiqu and preserves other settings when switching one', async () => {
    const settings = publicationChannelSettings({ publishToLinkedIn: false })
    const wrapper = await mountSuspended(PublicationChannels, {
      props: { modelValue: settings, linkedinConnected: false },
      global,
    })
    const switches = wrapper.findAll('[role="switch"]')
    expect(switches.map((control) => control.attributes('aria-label'))).toEqual([
      'common.preferences.publicationChannels.web',
      'common.preferences.publicationChannels.shopify',
      'common.preferences.publicationChannels.linkedin',
    ])
    expect(wrapper.text()).toContain('common.preferences.publicationChannels.needsSetup')
    await switches[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ ...settings, publishToShopify: false }])
  })
})
