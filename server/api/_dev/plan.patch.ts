const PLANS = ['BASIC', 'PRO', 'PREMIUM', 'CUSTOM'] as const

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const body = await readBody<{ id?: string; plan?: string }>(event)
  if (!body?.id || !PLANS.includes(body.plan as (typeof PLANS)[number])) {
    throw createError({ statusCode: 400, message: 'Invalid id or plan' })
  }

  const plan = body.plan as (typeof PLANS)[number]
  const id = body.id

  // Same transition path as the Stripe webhook / superadmin edit, or a locally switched
  // plan leaves features and billing behind and dev stops reproducing production.
  await prisma.$transaction(async (tx) => {
    await tx.clientSite.update({ where: { id }, data: { plan } })
    await syncPlanFeatures(tx, id, plan)
  })

  return { ok: true }
})
