/** Content-only locales (es, it, …) carry the public blog; every other page lives in an interface language. */
const READER_ROUTES = new Set(['index', 'clanky-slug', 'stitky-slug', 'autor-name'])

export default defineNuxtRouteMiddleware((to) => {
  // The prefix of `to`, not `$i18n.locale`: the switch to the target locale may not have happened yet.
  const locale = to.path.split('/')[1]
  if (!isLanguage(locale) || isUiLanguage(locale)) return
  const name = String(useRouteBaseName()(to) ?? '')
  if (READER_ROUTES.has(name)) return

  const { data } = useAuth()
  const target = uiLanguageOf(data.value?.user?.language, uiLanguageOf(usePreferenceCookies().language.value))
  const path = name ? useLocalePath()({ path: to.path, query: to.query, hash: to.hash }, target) : ''
  return navigateTo(path || homePath(target), { replace: true })
})
