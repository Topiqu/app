const BATCH_SIZE = 50
const DAY_MS = 24 * 60 * 60 * 1000

export default defineMonitoredTask({
  meta: {
    name: 'account-deletion',
    description: 'Remind accounts waiting for deletion and anonymise those past their restore period',
  },
  async run() {
    const now = new Date()
    let reminded = 0
    let anonymized = 0

    await settleClosingBilling()

    const dueReminders = await prisma.user.findMany({
      where: {
        anonymizedAt: null,
        deletionReminderSentAt: null,
        deletionRequestedAt: { not: null },
        deletionScheduledFor: { gt: now, lte: new Date(now.getTime() + ACCOUNT_DELETION_REMINDER_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        email: true,
        username: true,
        language: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
      },
      take: BATCH_SIZE,
    })
    for (const user of dueReminders) {
      // Claimed before sending, so overlapping runs cannot mail twice. A failed send is not retried.
      const claimed = await prisma.user.updateMany({
        where: { id: user.id, deletionReminderSentAt: null, deletionRequestedAt: user.deletionRequestedAt },
        data: { deletionReminderSentAt: now },
      })
      if (!claimed.count) continue
      try {
        await sendDeletionReminder({
          ...user,
          deletionRequestedAt: user.deletionRequestedAt!,
          deletionScheduledFor: user.deletionScheduledFor!,
        })
        reminded++
      } catch (error) {
        await reportCaughtError('Account deletion reminder failed', error, { userId: user.id })
      }
    }

    const due = await prisma.user.findMany({
      where: { anonymizedAt: null, deletionScheduledFor: { lte: now } },
      select: { id: true },
      take: BATCH_SIZE,
    })
    for (const { id } of due) {
      try {
        if (await anonymizeAccount(id, now)) anonymized++
      } catch (error) {
        await reportCaughtError('Account anonymisation failed', error, { userId: id })
      }
    }

    return { result: { reminded, anonymized } }
  },
})
