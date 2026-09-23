import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing generation session id' })
  const { action } = await readValidatedBody(event, z.object({ action: z.enum(['restore', 'dismiss']) }).parse)
  const session = await prisma.articleGenerationSession.findFirst({
    where: { id, userId: user.id, clientSiteId: user.clientSiteId! },
    select: { id: true },
  })
  if (!session) throw createError({ statusCode: 404, message: 'Generation session not found' })

  return prisma.articleGenerationSession.update({
    where: { id },
    data:
      action === 'restore'
        ? { status: 'RESTORED', restoredAt: new Date() }
        : { status: 'DISMISSED', dismissedAt: new Date() },
    select: { id: true, status: true },
  })
})
