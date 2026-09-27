// @vitest-environment nuxt

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

import LanguageMenu from '../../app/components/User/LanguageMenu.vue'
import UDropdownMenu from '../../node_modules/@nuxt/ui/dist/runtime/components/DropdownMenu.vue'

const { auth, locale, saveProfile, setLocale } = vi.hoisted(() => ({
  auth: { value: null as { user: { id: string } } | null },
  locale: { value: 'cs' },
  saveProfile: vi.fn(),
  setLocale: vi.fn(),
}))

mockNuxtImport('useAuth', () => () => ({ data: auth }))
mockNuxtImport('useProfile', () => () => ({ saveProfile }))
mockNuxtImport('useI18n', () => () => ({ locale, setLocale, t: (key: string) => key }))

enableAutoUnmount(afterEach)
afterEach(() => vi.clearAllMocks())

type Item = { value: string; checked: boolean; onUpdateChecked: () => Promise<void> }

const itemsOf = async () => {
  const wrapper = await mountSuspended(LanguageMenu, { global: { mocks: { $t: (key: string) => key } } })
  return wrapper.getComponent(UDropdownMenu).props('items') as Item[]
}

describe('UserLanguageMenu', () => {
  it('offers every locale and checks the active one', async () => {
    const items = await itemsOf()
    expect(items.map((item) => item.value)).toEqual(['en', 'cs', 'de', 'fr'])
    expect(items.filter((item) => item.checked).map((item) => item.value)).toEqual(['cs'])
  })

  it('saves the choice on the account before switching when signed in', async () => {
    auth.value = { user: { id: 'u1' } }
    const items = await itemsOf()
    await items.find((item) => item.value === 'de')!.onUpdateChecked()

    expect(saveProfile).toHaveBeenCalledWith({ language: 'de' })
    expect(setLocale).toHaveBeenCalledWith('de')
    expect(saveProfile.mock.invocationCallOrder[0]).toBeLessThan(setLocale.mock.invocationCallOrder[0]!)
  })

  it('only switches the locale for guests and ignores the active language', async () => {
    auth.value = null
    const items = await itemsOf()
    await items.find((item) => item.value === 'cs')!.onUpdateChecked()
    await items.find((item) => item.value === 'en')!.onUpdateChecked()

    expect(saveProfile).not.toHaveBeenCalled()
    expect(setLocale).toHaveBeenCalledExactlyOnceWith('en')
  })
})
