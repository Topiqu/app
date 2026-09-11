export default defineEventHandler(async (event) => {
  const { user } = await requireDb(event, { minRole: 'admin' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant' })
  if (user.role !== 'superadmin') await requireTenantMember(event, id)
  const wallet = await getTokenWallet(id)
  const { cursor } = getQuery(event)
  if (cursor && typeof cursor !== 'string') throw createError({ statusCode: 400, message: 'Invalid cursor' })
  const anchor = cursor
    ? await prisma.tokenLedgerEntry.findFirst({ where: { id: cursor as string, clientSiteId: id } })
    : null
  if (cursor && !anchor) throw createError({ statusCode: 400, message: 'Invalid cursor' })
  const rows = await prisma.tokenLedgerEntry.findMany({
    where: {
      clientSiteId: id,
      ...(anchor
        ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 21,
    select: { id: true, kind: true, amount: true, reason: true, createdAt: true, operationId: true },
  })
  const items = rows.slice(0, 20)
  return { wallet, items, nextCursor: rows.length > 20 ? items.at(-1)!.id : null }
})
