import {
  AGENCY_BLOCK_CENTS,
  AGENCY_BLOCK_UNITS,
  AGENCY_BLOG_CENTS,
  AGENCY_MAX_BLOCKS,
  AGENCY_MAX_BLOGS,
  AGENCY_MIN_BLOCKS,
  AGENCY_MIN_BLOGS,
  AGENCY_PREMIUM_CENTS,
} from '~~/shared/utils/agencyPlan'

const catalog = {
  blogCents: AGENCY_BLOG_CENTS,
  premiumCents: AGENCY_PREMIUM_CENTS,
  blockCents: AGENCY_BLOCK_CENTS,
  blockUnits: AGENCY_BLOCK_UNITS,
  minBlogs: AGENCY_MIN_BLOGS,
  maxBlogs: AGENCY_MAX_BLOGS,
  minBlocks: AGENCY_MIN_BLOCKS,
  maxBlocks: AGENCY_MAX_BLOCKS,
}

/** Blogs the person owns through their own team, not yet billed by an agency. */
const attachableBlogs = async (db: Awaited<ReturnType<typeof getEnhancedPrisma>>, userId: string) => {
  const rows = await db.tenantMembership.findMany({
    where: {
      userId,
      role: 'OWNER',
      deletedAt: null,
      billingAccountId: null,
      clientSite: { deletedAt: null, billingAccountId: null },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      clientSite: {
        select: { id: true, name: true, domain: true, billingProvider: true, stripeSubscriptionId: true },
      },
    },
  })
  return rows.map(({ clientSite: site }) => ({
    id: site.id,
    name: site.name,
    domain: site.domain,
    // Its own subscription has to end first, or the blog would be paid for twice.
    blocked:
      site.billingProvider !== 'STRIPE' ? 'SHOPIFY_BILLING' : site.stripeSubscriptionId ? 'OWN_SUBSCRIPTION' : null,
  }))
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role === 'ai') throw createError({ statusCode: 403, message: 'Forbidden' })
  const db = await getEnhancedPrisma(user)
  const member = await db.billingAccountMember.findFirst({
    where: { userId: user.id, deletedAt: null, account: { kind: 'AGENCY' } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { role: true, accountId: true },
  })
  const attachable = await attachableBlogs(db, user.id)
  if (!member) return { agency: null, attachable, catalog }

  const account = await db.billingAccount.findUnique({
    where: { id: member.accountId },
    select: {
      id: true,
      name: true,
      status: true,
      blogSlots: true,
      premiumSlots: true,
      unitBlocks: true,
      firstPaidAt: true,
      paidThrough: true,
      stripeCustomerId: true,
    },
  })
  if (!account) throw createError({ statusCode: 404, message: 'No agency', data: { code: 'NO_AGENCY' } })

  const [wallet, aiBudget, { period, blogs, usedUnits }, periods, members] = await Promise.all([
    getAccountWallet(account.id),
    getAccountAiBudget(account.id),
    agencyBlogUsage(account.id),
    agencyPeriods(account.id),
    db.billingAccountMember.findMany({
      where: { accountId: account.id, deletedAt: null },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, role: true, userId: true, user: { select: { email: true, username: true } } },
    }),
  ])

  return {
    catalog,
    attachable,
    role: member.role,
    agency: {
      id: account.id,
      name: account.name,
      status: account.status,
      blogSlots: account.blogSlots,
      premiumSlots: account.premiumSlots,
      unitBlocks: account.unitBlocks,
      firstPaidAt: account.firstPaidAt,
      paidThrough: account.paidThrough,
      hasBillingPortal: Boolean(account.stripeCustomerId),
    },
    period,
    periods,
    // Includes blogs that left the agency during the period.
    units: { available: wallet.available, reserved: wallet.reserved, used: usedUnits },
    // Null until the period's budget is funded, which is not the same as spent.
    aiBudgetLeft: aiBudget.total ? Math.round((aiBudget.remaining / aiBudget.total) * 100) : null,
    blogs,
    members: members.map((row) => ({
      id: row.id,
      role: row.role,
      email: row.user.email,
      username: row.user.username,
      self: row.userId === user.id,
    })),
  }
})
