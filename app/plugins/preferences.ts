export default defineNuxtPlugin({
  name: 'preferences',
  dependsOn: ['auth', 'i18n:plugin'],
  setup(nuxtApp) {
    const { data } = useAuth()
    const preferences = usePreferenceCookies()
    const colorMode = useColorMode()
    const localTheme = useCookie<string | null>('topiqu-color-mode', {
      path: '/',
      sameSite: 'lax',
      secure: useRequestURL().protocol === 'https:',
      maxAge: 31_536_000,
    })
    const apply = () => {
      const language = data.value?.user.language ?? preferences.language.value
      const theme = data.value?.user.theme ?? preferences.theme.value
      if (isPreferenceLanguage(language)) {
        preferences.language.value = language
        // Explicit locale-prefixed links keep their language; root visits use this preference.
        nuxtApp.$i18n.setLocaleCookie(language)
      }
      if (isPreferenceTheme(theme)) {
        preferences.theme.value = theme
        localTheme.value = theme
        colorMode.preference = theme
      }
    }
    apply()
    if (import.meta.client) {
      nuxtApp.hook('app:mounted', () => {
        if (
          !data.value?.user.theme &&
          !preferences.theme.value &&
          (!localTheme.value || localTheme.value === 'system')
        ) {
          try {
            const legacyTheme = localStorage.getItem('topiqu-color-mode')
            if (isPreferenceTheme(legacyTheme)) preferences.theme.value = legacyTheme
          } catch {
            // Storage may be unavailable in private browsing; the system preference still works.
          }
        }
        apply()
      })
      watch(() => [data.value?.user.language, data.value?.user.theme], apply)
    }
  },
})
