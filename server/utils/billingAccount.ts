import type { BillingAccount, ClientSite } from '~~/generated/zenstack/models'

/** The pool a blog spends from: its agency's, or its own DIRECT account (same id as the blog). */
export const spendingAccountId = (site: Pick<ClientSite, 'id' | 'billingAccountId'>) => site.billingAccountId ?? site.id

/** Select both wallets a blog can spend from; `poolOf` picks the one in effect. */
export const poolWalletSelect = <const S extends object>(select: S) => ({
  billingAccount: { select: { wallet: { select } } },
  directBillingAccount: { select: { wallet: { select } } },
})

export const poolOf = <W>(site: {
  billingAccount: { wallet: W | null } | null
  directBillingAccount: { wallet: W | null } | null
}) => (site.billingAccount ?? site.directBillingAccount)?.wallet ?? null

/** Lock order is always blog, then account, so no account lock is ever held while waiting for a blog. */
export const lockBlog = async (tx: DatabaseTransaction, id: string, { live = false } = {}) => {
  const rows = live
    ? await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "ClientSite" WHERE id = ${id} AND "deletedAt" IS NULL FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ClientSite" WHERE id = ${id} FOR UPDATE`
  if (!rows.length) throw createError({ statusCode: 404, message: 'Blog not found' })
  return tx.clientSite.findUniqueOrThrow({ where: { id } })
}

export const lockBillingAccount = async (tx: DatabaseTransaction, id: string) => {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "BillingAccount" WHERE id = ${id} FOR UPDATE`
  if (!rows.length) throw createError({ statusCode: 404, message: 'Billing account not found' })
  return tx.billingAccount.findUniqueOrThrow({ where: { id } })
}

export const lockBlogAccount = async (tx: DatabaseTransaction, clientSiteId: string, options?: { live?: boolean }) => {
  const site = await lockBlog(tx, clientSiteId, options)
  return { site, account: await lockBillingAccount(tx, spendingAccountId(site)) }
}

/** Agency terms live on the account; a DIRECT account's terms (plan, debts, AI baseline) stay on its blog. */
export const updateAccountTerms = (
  tx: DatabaseTransaction,
  account: Pick<BillingAccount, 'id' | 'kind'>,
  data: Partial<Record<'aiBudgetDebtMicros' | 'seoBudgetDebtMicros', number | { increment: number }>>,
) =>
  account.kind === 'AGENCY'
    ? tx.billingAccount.update({ where: { id: account.id }, data })
    : tx.clientSite.update({ where: { id: account.id }, data })

/** An agency blog is paid for by its agency; it cannot buy its own plan, seats or packs. */
export const rejectAgencyBilled = (site: Pick<ClientSite, 'billingAccountId'>) => {
  if (site.billingAccountId)
    throw createError({
      statusCode: 409,
      message: 'This blog is billed by its agency',
      data: { code: 'AGENCY_BILLING' },
    })
}
