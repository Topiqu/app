import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const { id: articleId } = event.context.params!
  const body = await readValidatedBody(
    event,
    z.object({ tagId: z.string() }).parse,
  )

  return await prisma.articleTag.create({
    data: {
      articleId,
      tagId: body.tagId,
    },
  })
})
