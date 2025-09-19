export default defineNuxtRouteMiddleware(async () => {
  const { data: auth, signOut } = useAuth()

  if (import.meta.server) return
  if (auth.value?.user && auth.value?.user.sessionId)
    try {
      await $fetch('/api/sessions/ping', { method: 'POST' })
    } catch {
      await signOut()
      throw createError({
        statusCode: 401,
        message: 'Relace byla zrušena, přihlaste se znovu',
      })
    }
})
