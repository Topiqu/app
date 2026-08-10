export default defineNuxtRouteMiddleware(async () => {
  const { data: auth, getSession } = useAuth()

  if (!auth.value?.user) await getSession()

  if (!auth.value?.user || auth.value.user.role !== 'superadmin') return navigateTo('/')
})
