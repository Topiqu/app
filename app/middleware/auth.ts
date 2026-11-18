export default defineNuxtRouteMiddleware((to) => {
  const { data: auth } = useAuth()
  const localePath = useLocalePath()

  // Redeem the new account's proof even when a previous account still has a session.
  if (to.query.created === 'true') return
  // An explicit registration must show which account is already signed in.
  if (to.query.mode === 'register') return

  if (auth.value?.user == null) return

  if (typeof to.query.invitation === 'string')
    return navigateTo(localePath({ name: 'invitation-token', params: { token: to.query.invitation } }))

  const intent = agencyIntentFromQuery(to.query)
  if (intent) {
    useAgencyIntent().value = intent
    return navigateTo(localePath({ name: 'admin-agency' }))
  }

  if (useRequestURL().hostname.replace(/^www\./, '') === 'app.topiqu.com')
    return navigateTo(localePath({ name: 'start' }))

  if (auth.value.user.role === 'superadmin') return navigateTo(localePath({ name: 'master' }))

  if (auth.value.user.role === 'admin') return navigateTo(localePath({ name: 'admin' }))
  else return navigateTo(localePath({ name: 'uzivatel' }))
})
