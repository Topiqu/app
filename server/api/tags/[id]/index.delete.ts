export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const tagId = event.context.params?.id
  if (!tagId) throw createError({ statusCode: 400, message: 'Tag ID je povinné' })

  await prisma.tag.delete({
    where: { id: tagId },
  })

  return { success: true }
})
