export default defineNuxtRouteMiddleware(() => {
  const { data: auth } = useAuth()

  if (auth.value?.user == null) return navigateTo('/')

  if (auth.value.user.role === 'superadmin') return navigateTo('/master')

  if (auth.value.user.role === 'admin') return navigateTo('/admin')

  return navigateTo('uzivatel/')
})
