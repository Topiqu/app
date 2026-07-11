export default defineNuxtRouteMiddleware(() => {
  const { data: auth } = useAuth()
  const localePath = useLocalePath()

  if (auth.value?.user == null) return

  if (auth.value.user.role === 'superadmin') return navigateTo(localePath({ name: 'master' }))

  if (auth.value.user.role === 'admin') return navigateTo(localePath({ name: 'admin' }))
  else return navigateTo(localePath({ name: 'uzivatel' }))
})
