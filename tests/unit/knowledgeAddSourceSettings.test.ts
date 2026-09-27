// @vitest-environment nuxt

import { createI18n } from 'vue-i18n'
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import AddSourceSettings from '../../app/components/Knowledge/AddSourceSettings.vue'
import URadioGroup from '../../node_modules/@nuxt/ui/dist/runtime/components/RadioGroup.vue'

enableAutoUnmount(afterEach)

const mount = (props: Record<string, unknown>) =>
  mountSuspended(AddSourceSettings, {
    props: { title: '', validAsOf: '', publicUrl: '', isPublic: false, today: '2026-09-27', showTitle: true, ...props },
    global: {
      plugins: [
        createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } }),
      ],
    },
  })

describe('Knowledge AddSourceSettings', () => {
  it('maps the citation choice onto isPublic', async () => {
    const wrapper = await mount({ kind: 'NOTE' })
    const radio = wrapper.getComponent(URadioGroup)

    expect(radio.props('modelValue')).toBe('INTERNAL')
    radio.vm.$emit('update:modelValue', 'PUBLIC')

    expect(wrapper.emitted('update:isPublic')?.at(-1)).toEqual([true])
  })

  it('asks for a public URL only when a citable source has no URL of its own', async () => {
    const note = await mount({ kind: 'NOTE', isPublic: true })
    expect(note.find('input[type="url"]').exists()).toBe(true)

    const page = await mount({ kind: 'URL', isPublic: true })
    expect(page.find('input[type="url"]').exists()).toBe(false)

    const internal = await mount({ kind: 'FILE', isPublic: false })
    expect(internal.find('input[type="url"]').exists()).toBe(false)
  })
})
