// @vitest-environment nuxt
import { flushPromises } from '@vue/test-utils'
import { shallowRef, type ShallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import LanguageMenu from '../../app/components/User/LanguageMenu.vue'

const mocks = vi.hoisted(() => ({
  locale: undefined as unknown as ShallowRef<string>,
  auth: undefined as unknown as ShallowRef<{ user: { language: string } } | null>,
  language: undefined as unknown as ShallowRef<string>,
  saveProfile: vi.fn(),
  setLocale: vi.fn(),
}))
mockNuxtImport('useAuth', () => () => ({ data: mocks.auth }))
mockNuxtImport('useI18n', () => () => ({ locale: mocks.locale, setLocale: mocks.setLocale }))
mockNuxtImport('useProfile', () => () => ({ saveProfile: mocks.saveProfile }))
mockNuxtImport('usePreferenceCookies', () => () => ({ language: mocks.language }))

const mounted: Array<{ unmount: () => void }> = []
const mount = async () => {
  const wrapper = await mountSuspended(LanguageMenu, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        UDropdownMenu: {
          props: ['items'],
          template:
            '<div><slot /><button v-for="item in items" :key="item.value" :data-language="item.value" @click="item.onUpdateChecked()">{{ item.label }}</button></div>',
        },
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.locale = shallowRef('cs')
  mocks.auth = shallowRef({ user: { language: 'en' } })
  mocks.language = shallowRef('en')
  mocks.saveProfile.mockResolvedValue({ language: 'cs' })
})
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('account language selection', () => {
  it('saves Czech for future notifications even when the current page is already Czech', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-language="cs"]').trigger('click')
    await flushPromises()
    expect(mocks.saveProfile).toHaveBeenCalledWith({ language: 'cs' })
    expect(mocks.setLocale).not.toHaveBeenCalled()
    expect(mocks.language.value).toBe('cs')
  }, 30_000)

  it('avoids resaving when the account and page language already match', async () => {
    mocks.auth.value = { user: { language: 'cs' } }
    const wrapper = await mount()
    await wrapper.get('[data-language="cs"]').trigger('click')
    await flushPromises()
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    expect(mocks.setLocale).not.toHaveBeenCalled()
  })

  it('changes the page language without an account write for a guest', async () => {
    mocks.auth.value = null
    const wrapper = await mount()
    await wrapper.get('[data-language="en"]').trigger('click')
    await flushPromises()
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    expect(mocks.setLocale).toHaveBeenCalledWith('en')
    expect(mocks.language.value).toBe('en')
  })
})
