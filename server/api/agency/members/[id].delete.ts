export default defineEventHandler(async (event) => {
  const { user, member } = await requireAgencyMember(event, { owner: true })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing member' })

  const removed = await serializableTransaction(async (tx) => {
    const target = await tx.billingAccountMember.findFirst({
      where: { id, accountId: member.accountId },
      select: { id: true, userId: true, role: true },
    })
    if (!target) throw createError({ statusCode: 404, message: 'Member not found' })
    if (target.id === member.id) throw createError({ statusCode: 400, message: 'You cannot remove yourself' })
    await tx.billingAccountMember.delete({ where: { id: target.id } })
    await revokeAgencyAccess(tx, member.accountId, { userId: target.userId })
    return target
  })
  await logAction({
    action: 'AGENCY_MEMBER_REMOVED',
    userId: user.id,
    ip: getIp(event),
    metadata: { billingAccountId: member.accountId, targetUserId: removed.userId, role: removed.role },
  })
  return { removed: true }
})
