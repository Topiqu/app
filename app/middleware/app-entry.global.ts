export default defineNuxtRouteMiddleware((to) => {
  if (useRequestURL().hostname.replace(/^www\./, '') !== 'app.topiqu.com') return
  if (!String(to.name ?? '').startsWith('index')) return

  const { data } = useAuth()
  const localePath = useLocalePath()
  // Both the bare app URL and legacy #articles links enter the project workspace.
  return navigateTo(localePath({ name: data.value?.user ? 'start' : 'autorizace' }), { replace: true })
})
