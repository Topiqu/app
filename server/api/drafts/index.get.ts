import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = query.status as string

  const where = status ? { status: status as any } : {}

  const drafts = await prisma.draftPost.findMany({
    where,
    include: {
      task: {
        include: { company: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return drafts
})
