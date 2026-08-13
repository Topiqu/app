import { toBillingInvoice } from '~~/server/utils/stripeInvoices'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if ((user.role !== 'admin' && user.role !== 'superadmin') || !user.clientSiteId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  if (user.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', user.clientSiteId)

  const db = await getEnhancedPrisma(user)
  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { stripeCustomerId: true },
  })
  if (!clientSite?.stripeCustomerId) return []

  const invoices = await useStripe().invoices.list({
    customer: clientSite.stripeCustomerId,
    limit: 12,
  })

  return invoices.data.map(toBillingInvoice)
})
