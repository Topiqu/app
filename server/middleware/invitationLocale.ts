export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const match = url.pathname.match(/^\/invitation\/([^/]+)\/?$/)
  if (!match?.[1]) return

  const invitation = await prisma.tenantInvitation.findUnique({
    where: { tokenHash: invitationTokenHash(decodeURIComponent(match[1])) },
    select: { clientSite: { select: { language: true } } },
  })
  const locale = invitation?.clientSite.language === 'cs' ? 'cs' : 'en'
  return sendRedirect(event, `/${locale}${url.pathname}${url.search}`, 302)
})
