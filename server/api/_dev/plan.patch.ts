const PLANS = ['BASIC', 'PRO', 'PREMIUM', 'CUSTOM'] as const

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const body = await readBody<{ id?: string; plan?: string }>(event)
  if (!body?.id || !PLANS.includes(body.plan as (typeof PLANS)[number])) {
    throw createError({ statusCode: 400, message: 'Invalid id or plan' })
  }

  await prisma.clientSite.update({ where: { id: body.id }, data: { plan: body.plan as (typeof PLANS)[number] } })
  return { ok: true }
})
