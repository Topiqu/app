import { getServerSession } from '#auth'
import { ArticleStatusSchema } from '~/shared/zod/enums'

const BodySchema = z.object({
  status: ArticleStatusSchema,
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ status: 401 })

  const body = await readValidatedBody(event, BodySchema.parse)
  const updated = await prisma.article.update({
    where: { id },
    data: { status: body.status },
  })

  return updated
})
