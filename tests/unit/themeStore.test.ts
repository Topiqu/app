import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useThemeStore } from '../../app/stores/theme'

const mocks = vi.hoisted(() => ({ preference: 'dark' as 'light' | 'dark', patch: vi.fn() }))

mockNuxtImport('useColorMode', () => () => ({
  get value() {
    return mocks.preference
  },
  get preference() {
    return mocks.preference
  },
  set preference(value: 'light' | 'dark') {
    mocks.preference = value
  },
}))
mockNuxtImport('useAuth', () => () => ({ data: ref({ user: { id: 'user-1' } }) }))
mockNuxtImport('useRequestFetch', () => () => mocks.patch)

describe('theme store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.preference = 'dark'
    mocks.patch.mockReset()
  })

  it('hydrates from Nuxt color mode without persisting', () => {
    const theme = useThemeStore()
    expect(theme.mode).toBe('dark')
    expect(theme.isDark).toBe(true)
    expect(mocks.patch).not.toHaveBeenCalled()
  })

  it('persists only an explicit toggle', async () => {
    const theme = useThemeStore()
    theme.mode = 'light'
    expect(mocks.patch).not.toHaveBeenCalled()

    await theme.toggle()
    expect(mocks.preference).toBe('dark')
    expect(mocks.patch).toHaveBeenCalledOnce()
    expect(mocks.patch).toHaveBeenCalledWith('/api/users/user-1', {
      method: 'PATCH',
      body: { theme: 'dark' },
    })
  })
})
