import { defineStore } from 'pinia'
import { useColorMode } from '@vueuse/core'

export const useThemeStore = defineStore(
  'theme',
  () => {
    const { data: user } = useAuth()
    const mode = useColorMode({
      attribute: 'class',
      modes: { light: 'light', dark: 'dark' },
      storageKey: 'theme',
      initialValue: 'light',
    })

    const toggle = async () => {
      const newMode = mode.value === 'light' ? 'dark' : 'light'
      mode.value = newMode
      if (user.value?.user.id) {
        try {
          await $fetch(`/api/users/${user.value.user.id}` as `/api/users/:id`, {
            method: 'PATCH',
            body: { theme: newMode },
          })
        } catch (e) {
          console.error('Chyba při ukládání tématu:', e)
        }
      }
    }

    return { mode, toggle }
  },
  {
    persist: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
    },
  },
)
