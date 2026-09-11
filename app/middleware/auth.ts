export default defineNuxtRouteMiddleware((to) => {
  const { data: auth } = useAuth()
  const localePath = useLocalePath()

  if (auth.value?.user == null) return

  if (typeof to.query.invitation === 'string')
    return navigateTo(localePath({ name: 'invitation-token', params: { token: to.query.invitation } }))

  if (useRequestURL().hostname.replace(/^www\./, '') === 'app.topiqu.com')
    return navigateTo(localePath({ name: 'start' }))

  if (auth.value.user.role === 'superadmin') return navigateTo(localePath({ name: 'master' }))

  if (auth.value.user.role === 'admin') return navigateTo(localePath({ name: 'admin' }))
  else return navigateTo(localePath({ name: 'uzivatel' }))
})
