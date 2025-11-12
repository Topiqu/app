import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)

  const userDb = await db.user.findUnique({
    where: { id: user.id },
    include: { clientSite: { select: { name: true } } },
  })

  if (!userDb?.username || !userDb?.email || !userDb?.id)
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const bans = await db.userBan.findMany({ where: { userId: user.id } })

  const formattedDate = new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(userDb.createdAt))

  const formattedLastLogin = userDb.lastLogin
    ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(userDb.lastLogin))
    : 'N/A'

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: { Title: `${t('profile.title')}_${userDb.username}`, Author: 'Topiqu' },
  })

  event.node.res.setHeader('Content-Type', 'application/pdf')
  event.node.res.setHeader('Content-Disposition', `attachment; filename=profile_${userDb.username}.pdf`)
  event.node.res.setHeader('Cache-Control', 'no-store')
  event.node.res.setHeader('Pragma', 'no-cache') // old browser fallback

  doc.pipe(event.node.res)
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const logoPath = join(__dirname, '../../public/app-logo.png')
  doc.rect(0, 0, 595, 80).fill('#f8fafc')
  try {
    doc.image(logoPath, 50, 20, { width: 150 })
  } catch {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#ff0000')
      .text(`${t('common.errors.failedToLoad')} logo`, 50, 20)
  }
  doc.moveDown(4)

  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor('#2563eb')
    .text(t('profile.data') || 'User Profile Data', { align: 'center' })
  doc
    .fontSize(18)
    .fillColor('#666666')
    .text(t('profile.pdfExportHeader') || 'GDPR-Compliant Export', { align: 'center' })
  doc.moveDown(3)

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#2563eb')
    .text(t('profile.userInformation') || 'User Information')
  doc.text(`${t('profile.username') || 'Username'}: ${userDb.username}`)
  doc.text(`${t('profile.email') || 'Email'}: ${userDb.email}`)
  doc.text(`${t('profile.bio') || 'Bio'}: ${userDb.bio || t('profile.bioNotFound')}`)
  doc.text(`${t('profile.accountId') || 'Account ID'}: ${userDb.id}`)
  doc.moveDown(2)

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#2563eb')
    .text(t('profile.accountDetails') || 'Account Details')
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e5e7eb').stroke()
  doc.moveDown(0.5)
  doc.font('Helvetica').fontSize(12).fillColor('#000000')
  doc.text(`${t('profile.registrationDate') || 'Registration Date'}: ${formattedDate}`)
  doc.text(
    `${t('profile.webNotifications') || 'Web Notifications'}: ${userDb.allowNotifs ? t('common.yes') || 'Yes' : t('common.no') || 'No'}`,
  )
  doc.text(
    `${t('profile.emailNotifications') || 'Email Notifications'}: ${userDb.allowEmail ? t('common.yes') || 'Yes' : t('common.no') || 'No'}`,
  )
  doc.text(`${t('profile.language') || 'Language'}: ${userDb.language || t('common.unknown') || 'Not specified'}`)
  doc.text(`${t('profile.roleLabel') || 'Role'}: ${userDb.role || t('common.unknown') || 'Not specified'}`)
  doc.text(
    `${t('profile.emailVerifiedLabel') || 'Email Verified'}: ${userDb.emailVerified ? t('common.yes') || 'Yes' : t('common.no') || 'No'}`,
  )
  doc.text(t('profile.lastLogin', { '0': formattedLastLogin }) || `Last Login: ${formattedLastLogin}`)
  doc.text(
    `${t('profile.associatedClient') || 'Associated Client Site'}: ${userDb.clientSite?.name || t('common.none') || 'None'} (ID: ${userDb.clientSiteId || t('common.none') || 'None'})`,
  )
  doc.moveDown(2)

  if (bans.length > 0) {
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#dc2626')
      .text(t('profile.userBans') || 'User Bans')
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#fca5a5').stroke()
    doc.moveDown(0.5)
    bans.forEach((ban, i) => {
      doc.font('Helvetica').fontSize(12).fillColor('#000000')
      doc.text(
        `${i + 1}. ${t('profile.banReasonLabel') || 'Reason'}: ${ban.reason || t('common.unknown') || 'Not specified'}`,
      )
      doc.text(
        `   ${t('profile.banDateLabel') || 'Date'}: ${new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ban.createdAt))}`,
      )
      doc.moveDown(0.5)
    })
    doc.moveDown(2)
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#2563eb')
    .text(t('profile.gdprCompliance') || 'GDPR Compliance')
  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e5e7eb').stroke()
  doc.moveDown(0.5)
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#333333')
    .text(
      t('profile.gdprText') ||
        'This document contains all personal data associated with your account, provided in accordance with GDPR regulations. For inquiries regarding data processing, contact our support team at support@topiqu.com.',
      { align: 'justify' },
    )

  doc.moveDown(2)
  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor('#999999')
    .text(
      t('profile.generatedOn', {
        '0': new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
      }) ||
        `Generated automatically by Topiqu on ${new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}.`,
      { align: 'right' },
    )

  doc
    .moveTo(50, 792 - 30)
    .lineTo(550, 792 - 30)
    .strokeColor('#e5e7eb')
    .stroke()

  doc.end()

  await new Promise((resolve, reject) => {
    event.node.res.on('finish', resolve)
    event.node.res.on('error', reject)
  })

  return null
})
