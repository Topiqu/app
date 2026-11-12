import { z } from 'zod'

/** Content work on every agency blog; billing, people and API keys stay with the owners. */
const MEMBER_SCOPES = [
  'ARTICLE_WRITE',
  'ARTICLE_WRITE_OTHERS',
  'ARTICLE_PUBLISH',
  'TENANT_SETTINGS',
  'INTEGRATION_CONTROL',
  'AI_USE',
  'ANALYTICS_READ',
  'CONTENT_MODERATE',
] as const

export default defineEventHandler(async (event) => {
  const { user, member } = await requireAgencyMember(event, { owner: true })
  if (!(await consumeRateLimit(`agency-members:${member.accountId}`, 20, 60 * 60)))
    throw createError({ statusCode: 429, message: 'Too many attempts', data: { code: 'RATE_LIMITED' } })
  const { email, role } = await readValidatedBody(
    event,
    z.object({ email: z.email().trim().toLowerCase(), role: z.enum(['OWNER', 'MEMBER']).default('MEMBER') }).parse,
  )
  const target = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null, emailVerified: true, role: { not: 'ai' } },
    select: { id: true },
  })
  // The same answer for an unknown and an unverified address, so the form is no account lookup.
  if (!target) throw createError({ statusCode: 404, message: 'No such account', data: { code: 'NO_ACCOUNT' } })

  await serializableTransaction(async (tx) => {
    if (await tx.billingAccountMember.count({ where: { userId: target.id, account: { kind: 'AGENCY' } } }))
      throw createError({ statusCode: 409, message: 'Already in an agency', data: { code: 'ALREADY_IN_AGENCY' } })
    await tx.billingAccountMember.create({
      data: {
        accountId: member.accountId,
        userId: target.id,
        role,
        scopes: role === 'OWNER' ? [...TENANT_SCOPES] : [...MEMBER_SCOPES],
      },
    })
  })
  await syncAgencyMemberships(member.accountId)
  await logAction({
    action: 'AGENCY_MEMBER_ADDED',
    userId: user.id,
    ip: getIp(event),
    metadata: { billingAccountId: member.accountId, targetUserId: target.id, role },
  })
  return { added: true }
})
