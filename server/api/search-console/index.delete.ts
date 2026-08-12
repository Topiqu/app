export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  await prisma.searchConsoleConnection.deleteMany({ where: { clientSiteId: user.clientSiteId! } })
  setResponseStatus(event, 204)
})
