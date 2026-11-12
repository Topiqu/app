import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'ai') throw createError({ statusCode: 403, message: 'Forbidden' })
  if (!(await consumeRateLimit(`agency-create:${user.id}`, 5, 60 * 60)))
    throw createError({ statusCode: 429, message: 'Too many attempts', data: { code: 'RATE_LIMITED' } })
  const { name } = await readValidatedBody(event, z.object({ name: z.string().trim().min(1).max(80) }).parse)

  const account = await serializableTransaction(async (tx) => {
    // One agency per person keeps every blog's projected access unambiguous.
    if (await tx.billingAccountMember.count({ where: { userId: user.id, account: { kind: 'AGENCY' } } }))
      throw createError({ statusCode: 409, message: 'Already in an agency', data: { code: 'ALREADY_IN_AGENCY' } })
    return tx.billingAccount.create({
      data: {
        kind: 'AGENCY',
        name,
        members: { create: { userId: user.id, role: 'OWNER', scopes: [...TENANT_SCOPES] } },
      },
      select: { id: true },
    })
  })
  await logAction({
    action: 'AGENCY_CREATED',
    userId: user.id,
    ip: getIp(event),
    metadata: { billingAccountId: account.id },
  })
  return account
})
