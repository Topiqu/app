export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID nenalezeno' })
  }

  const body = await readBody(event)
  const { name, slug } = body

  const tag = await db.tag.findUnique({ where: { id } })
  if (!tag) {
    throw createError({ statusCode: 404, message: 'Tag nenalezen' })
  }

  const data: any = {}
  if (name !== undefined) data.name = name
  if (slug !== undefined) data.slug = slug

  const updatedTag = await db.tag.update({
    where: { id },
    data,
  })

  return {
    tag: {
      id: updatedTag.id,
      name: updatedTag.name,
      slug: updatedTag.slug,
    },
  }
})
