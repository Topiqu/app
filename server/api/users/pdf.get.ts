import PDFDocument from 'pdfkit'
import { join } from 'node:path'

const PAGE = { width: 595.28, height: 841.89, left: 48, right: 48, top: 44, bottom: 56 }
const CONTENT_WIDTH = PAGE.width - PAGE.left - PAGE.right
const COLORS = {
  ink: '#18181B',
  body: '#3F3F46',
  muted: '#71717A',
  border: '#E4E4E7',
  surface: '#F8F7FC',
  violet: '#7C3AED',
  danger: '#DC2626',
  dangerSurface: '#FEF2F2',
}

const safeFilenamePart = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'user'

export default defineEventHandler(async (event) => {
  let { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  const db = await getEnhancedPrisma(user)
  const userDb = await db.user.findUnique({
    where: { id: user.id },
    include: { clientSite: { select: { name: true } } },
  })
  if (!userDb?.username || !userDb.email || !userDb.id)
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  ;({ translate: t } = await useServerI18n(event, { locale: userDb.language || 'en' }))
  const locale = userDb.language === 'cs' ? 'cs-CZ' : 'en-US'
  const bans = await db.userBan.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  const date = (value: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)
  const dateTime = (value: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  const yesNo = (value: boolean) => (value ? t('common.yes') || 'Yes' : t('common.no') || 'No')
  const none = t('common.none') || 'None'
  const filename = `topiqu-profile-${safeFilenamePart(userDb.username)}.pdf`

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right },
    bufferPages: true,
    info: {
      Title: `${t('profile.data') || 'User profile data'} - ${userDb.username}`,
      Author: 'Topiqu',
      CreationDate: new Date(),
    },
  })
  const { customFontBase64 } = await import('~~/server/utils/pdfFont')
  doc.registerFont('Topiqu', Buffer.from(customFontBase64, 'base64')).font('Topiqu')
  const font = 'Topiqu'

  event.node.res.setHeader('Content-Type', 'application/pdf')
  event.node.res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  )
  event.node.res.setHeader('Cache-Control', 'no-store')
  event.node.res.setHeader('Pragma', 'no-cache')
  doc.pipe(event.node.res)

  const ensureSpace = (height: number) => {
    if (doc.y + height > PAGE.height - PAGE.bottom) doc.addPage()
  }
  const sectionTitle = (title: string, color = COLORS.violet) => {
    ensureSpace(42)
    doc
      .font(font)
      .fillColor(color)
      .fontSize(12)
      .text(title.toUpperCase(), PAGE.left, doc.y, { width: CONTENT_WIDTH, characterSpacing: 0.7 })
    doc.moveDown(0.55)
  }
  const card = (rows: Array<[string, string]>, danger = false) => {
    const labelWidth = 166
    const innerWidth = CONTENT_WIDTH - 32
    const heights = rows.map(
      ([label, value]) =>
        Math.max(
          doc.font(font).fontSize(9).heightOfString(label, { width: labelWidth }),
          doc
            .font(font)
            .fontSize(10.5)
            .heightOfString(value, { width: innerWidth - labelWidth }),
          18,
        ) + 10,
    )
    const height = heights.reduce((sum, value) => sum + value, 0) + 14
    ensureSpace(height + 12)
    const top = doc.y
    doc
      .roundedRect(PAGE.left, top, CONTENT_WIDTH, height, 12)
      .fillAndStroke(danger ? COLORS.dangerSurface : '#FFFFFF', danger ? '#FECACA' : COLORS.border)
    let rowY = top + 12
    rows.forEach(([label, value], index) => {
      doc
        .font(font)
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(label, PAGE.left + 16, rowY + 3, { width: labelWidth })
      doc
        .font(font)
        .fontSize(10.5)
        .fillColor(danger ? '#991B1B' : COLORS.ink)
        .text(value, PAGE.left + 16 + labelWidth, rowY + 2, { width: innerWidth - labelWidth })
      rowY += heights[index]!
      if (index < rows.length - 1)
        doc
          .moveTo(PAGE.left + 16, rowY - 4)
          .lineTo(PAGE.width - PAGE.right - 16, rowY - 4)
          .strokeColor(COLORS.border)
          .lineWidth(0.6)
          .stroke()
    })
    doc.y = top + height + 18
  }

  doc.rect(0, 0, PAGE.width, 116).fill(COLORS.surface)
  doc.rect(0, 0, 7, 116).fill(COLORS.violet)
  try {
    doc.image(join(process.cwd(), 'public', 'app-logo.png'), PAGE.left, 26, { fit: [110, 34] })
  } catch {
    doc.font(font).fontSize(18).fillColor(COLORS.violet).text('Topiqu', PAGE.left, 32)
  }
  doc
    .font(font)
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(t('profile.pdfExportHeader') || 'Account data export', 344, 32, { width: 203, align: 'right' })
  doc.text(dateTime(new Date()), 344, 51, { width: 203, align: 'right' })
  doc.y = 145
  doc
    .font(font)
    .fontSize(25)
    .fillColor(COLORS.ink)
    .text(t('profile.data') || 'User profile data')
  doc.moveDown(0.25).fontSize(11).fillColor(COLORS.muted).text(`@${userDb.username}  ·  ${userDb.email}`)
  doc.moveDown(1.7)

  sectionTitle(t('profile.userInformation') || 'User information')
  card([
    [t('profile.username') || 'Username', userDb.username],
    [t('profile.email') || 'Email', userDb.email],
    [t('profile.bio') || 'Bio', userDb.bio || t('profile.bioNotFound') || none],
    [t('profile.accountId') || 'Account ID', userDb.id],
  ])
  sectionTitle(t('profile.accountDetails') || 'Account details')
  card([
    [t('profile.registrationDate') || 'Registration date', date(new Date(userDb.createdAt))],
    [
      t('profile.lastLogin', { '0': '' })?.replace(/[:\s]+$/, '') || 'Last login',
      userDb.lastLogin ? dateTime(new Date(userDb.lastLogin)) : none,
    ],
    [t('profile.language') || 'Language', userDb.language || none],
    [t('profile.roleLabel') || 'Role', userDb.role || none],
    [t('profile.emailVerifiedLabel') || 'Email verified', yesNo(Boolean(userDb.emailVerified))],
    [t('profile.associatedClient') || 'Associated client', userDb.clientSite?.name || none],
  ])
  sectionTitle(t('profile.notifications') || 'Notifications')
  card([
    [t('profile.webNotifications') || 'Web notifications', yesNo(Boolean(userDb.allowNotifs))],
    [t('profile.emailNotifications') || 'Email notifications', yesNo(Boolean(userDb.allowEmail))],
  ])
  if (bans.length) {
    sectionTitle(t('profile.userBans') || 'User bans', COLORS.danger)
    bans.forEach((ban, index) =>
      card(
        [
          [`${t('profile.userBans') || 'User ban'} #${index + 1}`, ban.reason || t('common.unknown') || none],
          [t('profile.banDateLabel') || 'Date', dateTime(new Date(ban.createdAt))],
        ],
        true,
      ),
    )
  }
  sectionTitle(t('profile.gdprCompliance') || 'Data export')
  const gdprText = t('profile.gdprText') || ''
  const gdprHeight =
    doc
      .font(font)
      .fontSize(9.5)
      .heightOfString(gdprText, { width: CONTENT_WIDTH - 32, lineGap: 2 }) + 28
  ensureSpace(gdprHeight + 12)
  const gdprY = doc.y
  doc.roundedRect(PAGE.left, gdprY, CONTENT_WIDTH, gdprHeight, 12).fill(COLORS.surface)
  doc
    .font(font)
    .fontSize(9.5)
    .fillColor(COLORS.body)
    .text(gdprText, PAGE.left + 16, gdprY + 14, { width: CONTENT_WIDTH - 32, lineGap: 2 })

  const range = doc.bufferedPageRange()
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex)
    const footerY = PAGE.height - PAGE.bottom - 10
    doc
      .moveTo(PAGE.left, footerY - 8)
      .lineTo(PAGE.width - PAGE.right, footerY - 8)
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .stroke()
    doc
      .font(font)
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text('Topiqu', PAGE.left, footerY, { width: 100, lineBreak: false })
    doc.text(`${pageIndex - range.start + 1} / ${range.count}`, PAGE.width - PAGE.right - 32, footerY, {
      width: 32,
      lineBreak: false,
    })
  }
  doc.end()
  await new Promise<void>((resolve, reject) => {
    event.node.res.on('finish', resolve)
    event.node.res.on('error', reject)
  })
  return null
})
