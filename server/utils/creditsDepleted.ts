import type { Language } from '~~/generated/zenstack/models'

import { isLanguage } from '~~/shared/utils/language'

/**
 * Emails a scheduled tenant's owners and billing members that its articles ran out. Once per
 * depletion: the key names the newest grant, so only a top-up re-arms it. Sent before the audit
 * row is written, so an SES failure retries on the next cron run instead of going silent.
 */
export const notifyCreditsDepleted = async (clientSiteId: string) => {
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      name: true,
      domain: true,
      logoUrl: true,
      articleCreditWallet: {
        select: { grants: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
      },
      tenantMemberships: {
        where: {
          deletedAt: null,
          OR: [{ role: 'OWNER' }, { scopes: { has: 'BILLING_CHANGE' } }],
          user: { emailVerified: true, role: { not: 'ai' } },
        },
        select: { user: { select: { id: true, email: true, language: true } } },
      },
    },
  })
  if (!site?.tenantMemberships.length) return { sent: 0 }

  const idempotencyKey = `credits-depleted:${clientSiteId}:${site.articleCreditWallet?.grants[0]?.id ?? 'none'}`
  if (await prisma.log.findUnique({ where: { idempotencyKey }, select: { id: true } })) return { sent: 0 }

  const origin = import.meta.dev ? 'http://localhost:3000' : `https://${site.domain}`
  const recipients = site.tenantMemberships.map(({ user }) => user)
  for (const user of recipients) {
    const lang: Language = isLanguage(user.language) ? user.language : 'en'
    await sendEmail({
      to: user.email,
      lang,
      template: 'creditsDepleted',
      data: {
        tenantName: site.name,
        tenantLogoUrl: site.logoUrl ?? '',
        topUpUrl: `${origin}/${lang}/settings?tab=billing`,
      },
    })
  }

  await logAction({
    action: 'CREDITS_DEPLETED_NOTIFIED',
    clientSiteId,
    idempotencyKey,
    metadata: { recipients: recipients.map(({ id }) => id) },
  })
  return { sent: recipients.length }
}
