import { z } from 'zod'

const InputSchema = z.object({
  imageUrl: z.string().max(2048).nullable().optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
  content: z.string().max(50000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const input = await readValidatedBody(event, InputSchema.parse)
  return evaluateMediaRights(prisma, user.clientSiteId!, input)
})
