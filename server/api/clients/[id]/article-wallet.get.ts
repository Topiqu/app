export default defineEventHandler(async (event) => {
  const { user } = await requireDb(event, { minRole: 'admin' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant' })
  if (user.role !== 'superadmin') await requireTenantMember(event, id)

  const wallet = await getArticleCreditWallet(id)
  const query = getQuery(event)
  if (query.cursor && typeof query.cursor !== 'string')
    throw createError({ statusCode: 400, message: 'Invalid cursor' })
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined
  const anchor = cursor
    ? await prisma.articleCreditLedgerEntry.findFirst({ where: { id: cursor, clientSiteId: id } })
    : null
  if (cursor && !anchor) throw createError({ statusCode: 400, message: 'Invalid cursor' })

  const rows = await prisma.articleCreditLedgerEntry.findMany({
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
