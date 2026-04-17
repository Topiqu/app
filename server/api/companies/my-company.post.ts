import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Grab the first company for MVP purposes
  let company = await prisma.linkedinCompany.findFirst()

  if (!company) {
    // If we don't have a company yet, create a dummy one linked to the first client site
    const clientSite = await prisma.clientSite.findFirst()
    if (!clientSite) throw createError({ statusCode: 400, message: 'No client site found to attach company to' })

    company = await prisma.linkedinCompany.create({
      data: {
        name: 'My Company',
        linkedinOrgId: '123456',
        clientSiteId: clientSite.id,
        mode: body.mode || 'HitL',
      },
    })
  } else {
    company = await prisma.linkedinCompany.update({
      where: { id: company.id },
      data: { mode: body.mode },
    })
  }

  if (body.brandProfile) {
    await prisma.brandProfile.upsert({
      where: { companyId: company.id },
      create: {
        companyId: company.id,
        tone: body.brandProfile.tone,
        audience: body.brandProfile.audience,
        doList: body.brandProfile.doList,
        dontList: body.brandProfile.dontList,
      },
      update: {
        tone: body.brandProfile.tone,
        audience: body.brandProfile.audience,
        doList: body.brandProfile.doList,
        dontList: body.brandProfile.dontList,
      },
    })
  }

  return { success: true }
})
