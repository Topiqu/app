export default defineNuxtRouteMiddleware(async () => {
  const { data: auth, signOut } = useAuth()

  if (import.meta.server || !auth.value?.user) return
  // A session revoked elsewhere fails the ping; signing out reloads the page as a guest.
  await $fetch('/api/sessions/ping', { method: 'POST' }).catch(() => signOut())
})
