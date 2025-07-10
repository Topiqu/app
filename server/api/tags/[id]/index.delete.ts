import { createError } from 'h3'
import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const tagId = event.context.params?.id
  if (!tagId)
    throw createError({ statusCode: 400, statusMessage: 'Tag ID je povinné' })

  await prisma.tag.delete({
    where: { id: tagId },
  })

  return { success: true }
})
