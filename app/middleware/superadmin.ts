export default defineNuxtRouteMiddleware(() => {
  const { data: auth } = useAuth()

  if (!auth.value?.user || auth.value.user.role !== 'superadmin') return navigateTo('/')
})
