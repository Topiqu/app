import PDFDocument from 'pdfkit'

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

const fetchImageBuffer = async (url: string): Promise<Buffer | null> => {
  try {
    if (!isCdnImageUrl(url)) return null
    const blob = await $fetch<Blob>(url, { responseType: 'blob' })
    return Buffer.from(await blob.arrayBuffer())
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const body = await readBody<{ ids: string[] }>(event)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === 'string') : []
  if (!ids.length) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)

  const articles = await db.article.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      status: true,
    },
  })

  if (!articles.length) throw createError({ statusCode: 404, message: t('common.errors.notFound')! })

  const { customFontBase64 } = await import('~~/server/utils/pdfFont')
  const fontBuffer = customFontBase64 ? Buffer.from(customFontBase64, 'base64') : null

  const filename =
    articles.length === 1
      ? `article-${articles[0]!.slug}.pdf`
      : `articles-export-${new Date().toISOString().slice(0, 10)}.pdf`

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: { Title: filename, Author: 'Topiqu' },
  })

  if (fontBuffer) {
    doc.registerFont('Custom', fontBuffer)
    doc.font('Custom')
  }

  event.node.res.setHeader('Content-Type', 'application/pdf')
  event.node.res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
  event.node.res.setHeader('Cache-Control', 'no-store')

  doc.pipe(event.node.res)

  const dateFmt = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short' })

  if (articles.length === 1) {
    const article = articles[0]!

    doc.fontSize(20).fillColor('#111827').text(article.title, { align: 'left' })
    doc.moveDown(0.5)
    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(`${article.status} · ${dateFmt.format(new Date(article.createdAt))}`)
    doc.moveDown(1)

    if (article.imageUrl) {
      const img = await fetchImageBuffer(article.imageUrl)
      if (img) {
        try {
          doc.image(img, { fit: [495, 240], align: 'center' })
          doc.moveDown(1)
        } catch {
          // skip unsupported format
        }
      }
    }

    doc.fontSize(11).fillColor('#111827').text(stripHtml(article.content), { align: 'justify', lineGap: 2 })
  } else {
    doc.fontSize(18).fillColor('#111827').text(t('articles.exportTitle') || 'Articles export', { align: 'left' })
    doc.moveDown(1)

    articles.forEach((article, i) => {
      doc.fontSize(13).fillColor('#2563eb').text(`${i + 1}. ${article.title}`)
      doc
        .fontSize(9)
        .fillColor('#6b7280')
        .text(`${article.status} · ${dateFmt.format(new Date(article.createdAt))} · /${article.slug}`)
      doc.moveDown(0.3)
      const preview = stripHtml(article.content).slice(0, 400)
      if (preview) {
        doc.fontSize(10).fillColor('#374151').text(preview, { align: 'justify' })
      }
      doc.moveDown(0.8)
    })
  }

  doc.end()

  await new Promise<void>((resolve, reject) => {
    event.node.res.on('finish', () => resolve())
    event.node.res.on('error', reject)
  })

  return null
})
