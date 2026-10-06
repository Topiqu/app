/** IndexNow ownership proof: engines fetch it to check that the submitted key belongs to this host. */
export default defineEventHandler(async (event) => {
  const tenant = await tenantByHost(event)
  if (!tenant) throw createError({ statusCode: 404, message: 'Not found' })

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return indexNowKey(tenant.id)
})
