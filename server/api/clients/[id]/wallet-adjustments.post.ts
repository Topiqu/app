import { z } from 'zod'

const schema = z.object({
  amount: z.number().int().positive().max(10000000),
  kind: z.enum(['CREDIT', 'BONUS', 'DEBIT', 'REFUND']),
  reason: z.string().trim().min(3).max(500),
  key: z.string().uuid(),
  operationId: z.string().min(1).max(100).optional(),
})
export default defineEventHandler(async (event) => {
  const { user } = await requireDb(event, { minRole: 'superadmin' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant' })
  const body = await readValidatedBody(event, schema.parse)
  return adjustTokenWallet({ ...body, clientSiteId: id, actorId: user.id })
})
