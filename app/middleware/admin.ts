export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const url = useRequestURL()
  const baseDomain = useRuntimeConfig().public.baseDomain
  const { data: auth } = useAuth()
  const user = auth.value?.user

  if (!user || user.role !== 'admin') return navigateTo('/')

  const host = await useClientSite()
  // Verified customer hosts have their own authenticated session. Tenant equality still
  // gates their administration; provider OAuth separately confirms the account centrally.
  if (!isForeignHost(host?.id, user.clientSiteId)) return

  // Foreign blog: the page would read its plan, ids and domain from that tenant while every
  // mutation hit ours. Send the admin to the same path on their own host instead.
  const { data: status } = await useClientSiteStatus()
  const ownDomain = status.value?.domainVerified
    ? isManagedDomain(status.value.domain, baseDomain)
      ? normalizeDomain(status.value.domain)
      : `app.${normalizeDomain(baseDomain)}`
    : ''

  if (!ownDomain || toHostname(ownDomain) === toHostname(url.host)) return nuxtApp.runWithContext(() => navigateTo('/'))

  const own = `${url.protocol}//${ownDomain}${to.fullPath}`

  return nuxtApp.runWithContext(() => navigateTo(own, { external: true }))
})
