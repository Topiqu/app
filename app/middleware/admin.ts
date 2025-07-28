export default defineNuxtRouteMiddleware(() => {
  const { data: authData } = useAuth()
  if (!authData.value?.user || authData.value.user.role !== 'admin') {
    return navigateTo('/')
  }
})
