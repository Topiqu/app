/** Repairs what an agency writes outside one transaction: its blogs' plan cache and projected access. */
export default defineMonitoredTask({
  meta: {
    name: 'agency-sync',
    description: 'Reconciles agency blog plans and projected memberships',
  },
  async run() {
    const accounts = await prisma.billingAccount.findMany({ where: { kind: 'AGENCY' }, select: { id: true } })
    let failed = 0
    for (const { id } of accounts) {
      try {
        await syncAgencySites(id)
        await syncAgencyMemberships(id)
      } catch (error) {
        failed += 1
        await reportCaughtError('Agency sync failed', error, { billingAccountId: id })
      }
    }
    return { result: { accounts: accounts.length, failed } }
  },
})
