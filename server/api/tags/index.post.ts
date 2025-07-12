import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const body = await readValidatedBody(event, TagCreateSchema.parse)

  const existingTag = await prisma.tag.findUnique({
    where: { name: body.name },
  })

  if (existingTag)
    throw createError({
      statusCode: 409,
      statusMessage: 'Tag s tímto názvem už existuje',
    })

  const tag = await prisma.tag.create({
    data: {
      name: body.name,
    },
  })

  return tag
})
