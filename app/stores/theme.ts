import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', () => {
  const { data: user } = useAuth()
  const colorMode = useColorMode()
  const requestFetch = useRequestFetch()

  const mode = computed<'light' | 'dark'>({
    get: () => (colorMode.value === 'dark' ? 'dark' : 'light'),
    set: (value) => {
      colorMode.preference = value
    },
  })

  const isDark = computed(() => mode.value === 'dark')

  const persist = async (newMode: 'light' | 'dark') => {
    if (user.value?.user.id) {
      try {
        await requestFetch(`/api/users/${user.value.user.id}` as `/api/users/:id`, {
          method: 'PATCH',
          body: { theme: newMode },
        })
      } catch (e) {
        console.error('Chyba při ukládání tématu:', e)
      }
    }
  }

  const toggle = async () => {
    const newMode = isDark.value ? 'light' : 'dark'
    colorMode.preference = newMode
    await persist(newMode)
  }

  const persistSelection = async () => {
    await nextTick()
    await persist(mode.value)
  }

  return { mode, isDark, persistSelection, toggle }
})
