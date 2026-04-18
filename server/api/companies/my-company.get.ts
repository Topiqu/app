import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Mocking auth / client site ID logic for the MVP since we don't have full auth setup in this plan
  // Typically: const session = await requireAuthSession(event); const clientSiteId = session.user.clientSiteId

  const query = getQuery(event)
  const appType = (query.type as string) || 'pages'

  // Just grab the first company for MVP purposes, optionally filtered by type
  const company = await prisma.linkedinCompany.findFirst({
    where: { type: appType },
    include: { brandProfile: true },
  })

  return company || {}
})
