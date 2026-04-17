import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Mocking auth / client site ID logic for the MVP since we don't have full auth setup in this plan
  // Typically: const session = await requireAuthSession(event); const clientSiteId = session.user.clientSiteId

  // Just grab the first company for MVP purposes
  const company = await prisma.linkedinCompany.findFirst({
    include: { brandProfile: true },
  })

  return company || {}
})
