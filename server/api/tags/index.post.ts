export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = await readValidatedBody(event, TagCreateSchema.parse)

  const db = await getEnhancedPrisma(user)
  const existingTag = await db.tag.findFirst({
    where: { name: body.name, clientSiteId: user.clientSiteId },
  })

  if (existingTag)
    throw createError({
      statusCode: 409,
      message: 'Tag s tímto názvem už existuje.',
    })
  const tag = await db.tag.create({
    data: {
      name: body.name,
      slug: body.slug,
      clientSiteId: user.clientSiteId,
    },
  })

  return tag
})
