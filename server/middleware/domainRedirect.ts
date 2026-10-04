/** A blog that moved domains keeps its old links and rankings: the old host answers with a 301. */
export default defineEventHandler(async (event) => {
  const hostname = tenantHostname(event)
  if (!hostname || event.path.startsWith('/_nuxt/')) return
  if (await cachedTenantByHost(event)) return

  const target = await domainRedirectTarget(hostname)
  if (!target) return
  const url = getRequestURL(event)
  // 308 keeps the method and body of a non-GET request; a 301 may turn it into a GET.
  return sendRedirect(event, `https://${target}${url.pathname}${url.search}`, ['GET', 'HEAD'].includes(event.method) ? 301 : 308)
})
