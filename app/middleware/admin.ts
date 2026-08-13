import { callWithNuxt } from '#app'
import { isForeignHost, normalizeDomain, toHostname } from '~~/shared/utils/domain'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const url = useRequestURL()
  const { data: auth } = useAuth()
  const user = auth.value?.user

  if (!user || user.role !== 'admin') return navigateTo('/')

  const host = await useClientSite()
  if (!isForeignHost(host?.id, user.clientSiteId)) return

  // Foreign blog: the page would read its plan, ids and domain from that tenant while every
  // mutation hit ours. Send the admin to the same path on their own host instead.
  const { data: status } = await useClientSiteStatus()
  const ownDomain = status.value?.domainVerified ? normalizeDomain(status.value.domain ?? '') : ''

  if (!ownDomain || toHostname(ownDomain) === toHostname(url.host))
    return await callWithNuxt(nuxtApp, navigateTo, ['/'])

  const own = `${url.protocol}//${ownDomain}${to.fullPath}`

  return await callWithNuxt(nuxtApp, navigateTo, [own, { external: true }])
})
