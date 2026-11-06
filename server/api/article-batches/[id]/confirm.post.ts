import { z } from 'zod'

const topic = z.string().trim().min(3).max(300)

const schema = z
  .object({
    mode: z.enum(['SPREAD', 'DRAFTS']),
    paceHours: z
      .number()
      .refine((value): value is BatchPaceHours => (BATCH_PACE_HOURS as readonly number[]).includes(value))
      .default(DEFAULT_BATCH_PACE_HOURS),
    items: z.array(z.object({ id: z.string().uuid(), topic })).max(MAX_BATCH_ITEMS),
    customTopics: z.array(topic).max(MAX_BATCH_ITEMS),
  })
  .refine(({ items, customTopics }) => {
    const total = items.length + customTopics.length
    return total > 0 && total <= MAX_BATCH_ITEMS
  })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)
  const { user, clientSiteId } = await requireArticleBatchAccess(event, body.mode)
  await ensureMinAccountAge(event, user.id)
  const id = z.string().uuid().parse(getRouterParam(event, 'id'))
  return confirmArticleBatch({
    ...body,
    paceHours: body.paceHours as BatchPaceHours,
    id,
    clientSiteId,
    userId: user.id,
  })
})
