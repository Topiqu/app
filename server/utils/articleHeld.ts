/**
 * Tells the people who can publish that the autopilot held a finished article back, with a link to the
 * editor banner. Once per article; sent before the audit row, so a failed send retries on a later run.
 */
export const notifyArticleHeld = async (clientSiteId: string, article: { id: string; slug: string; title: string }) => {
  const idempotencyKey = `article-held:${article.id}`
  if (await prisma.log.findUnique({ where: { idempotencyKey }, select: { id: true } })) return { sent: 0 }
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      name: true,
      domain: true,
      logoUrl: true,
      tenantMemberships: {
        where: {
          deletedAt: null,
          OR: [{ role: 'OWNER' }, { scopes: { has: 'ARTICLE_PUBLISH' } }],
          user: { emailVerified: true, role: { not: 'ai' }, deletedAt: null },
        },
        select: { user: { select: { id: true, email: true, language: true } } },
      },
    },
  })
  if (!site?.tenantMemberships.length) return { sent: 0 }

  const origin = import.meta.dev ? 'http://localhost:3000' : `https://${site.domain}`
  const recipients = site.tenantMemberships.map(({ user }) => user)
  for (const user of recipients) {
    const lang = uiLanguageOf(user.language)
    const editorPath = `/${lang}/admin/editor/${encodeURIComponent(article.slug)}`
    const translate = await getServerTranslator(lang)
    await prisma.notification.create({
      data: {
        // The column caps at 255 characters; a long title must not lose the notification.
        message: translate('common.notifications.articleHeld', [article.title])!.slice(0, 255),
        userId: user.id,
        articleId: article.id,
        link: editorPath,
        type: 'SYSTEM',
      },
    })
    await sendEmail({
      to: user.email,
      lang,
      template: 'articleHeld',
      data: {
        tenantName: site.name,
        tenantLogoUrl: site.logoUrl ?? '',
        articleTitle: article.title,
        reviewUrl: `${origin}${editorPath}`,
      },
    })
  }

  await logAction({
    action: 'ARTICLE_HELD_NOTIFIED',
    clientSiteId,
    idempotencyKey,
    metadata: { articleId: article.id, recipients: recipients.map(({ id }) => id) },
  })
  return { sent: recipients.length }
}
