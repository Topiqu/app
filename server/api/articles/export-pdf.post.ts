import { z } from 'zod'
import sharp from 'sharp'
import PDFDocument from 'pdfkit'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { languageTag } from '~~/shared/utils/language'
import { htmlToText } from '~~/shared/utils/articleBlocks'

import { fetchPublicUrl, readLimitedBody } from '../../utils/images/publicFetch'

const inputSchema = z.object({ ids: z.array(z.string().min(1).max(128)).min(1).max(100) }).strict()
let activeExports = 0

const stripHtml = (html: string | null | undefined): string => {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .split('\n')
    .map((line) => htmlToText(line))
    .join('\n')
    .trim()
}

const fetchImageBuffer = async (url: string, signal: AbortSignal): Promise<Buffer | null> => {
  try {
    if (!isCdnImageUrl(url)) return null
    const target = new URL(url, useRuntimeConfig().public.cdnUrl)
    const response = await fetchPublicUrl(target, 5000, signal, { redirect: 'error' })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error('PDF_IMAGE_UNAVAILABLE')
    }
    const bytes = await readLimitedBody(response, 3_000_000)
    const image = sharp(bytes, { limitInputPixels: 16_000_000 })
    const metadata = await image.metadata()
    if (!['png', 'jpeg', 'webp', 'avif'].includes(metadata.format ?? '')) throw new Error('PDF_IMAGE_UNSUPPORTED')
    const buffer = await image
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    signal.throwIfAborted()
    return buffer
  } catch {
    signal.throwIfAborted()
    await reportCaughtError('PDF cover omitted', new Error('PDF_IMAGE_UNAVAILABLE')).catch(() => {})
    return null
  }
}

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const parsed = inputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const ids = [...new Set(parsed.data.ids)]
  if (!(await consumeRateLimit(`pdf-export:${membership.clientSiteId}:${user.id}`, 5, 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  if (activeExports >= 4) throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  activeExports += 1
  try {
    const db = await getEnhancedPrisma(user)

    // Same author filter as the admin list in articles/search.ts.
    const articles = await db.article.findMany({
      take: 100,
      where: {
        id: { in: ids },
        clientSiteId: membership.clientSiteId,
        ...(hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS')
          ? {}
          : { OR: [{ userId: user.id }, { user: { role: 'ai' as const } }] }),
      },
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
    if (
      articles.some((article) => article.content.length > 100_000) ||
      articles.reduce((bytes, article) => bytes + Buffer.byteLength(article.content), 0) > 2_000_000
    )
      throw createError({ statusCode: 413, message: t('common.errors.invalidRequest')! })

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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(new Error('PDF_EXPORT_TIMEOUT')), 30_000)
    const disconnected = () => {
      if (!event.node.res.writableFinished) controller.abort(new Error('PDF_EXPORT_DISCONNECTED'))
    }
    event.node.res.once('close', disconnected)
    let completion: Promise<void> | undefined
    let pageCount = 1
    doc.on('pageAdded', () => {
      controller.signal.throwIfAborted()
      if (++pageCount > 50) throw createError({ statusCode: 413, message: t('common.errors.invalidRequest')! })
    })
    try {
      if (event.node.res.destroyed) controller.abort(new Error('PDF_EXPORT_DISCONNECTED'))
      controller.signal.throwIfAborted()

      if (fontBuffer) {
        doc.registerFont('Custom', fontBuffer)
        doc.font('Custom')
      }

      event.node.res.setHeader('Content-Type', 'application/pdf')
      event.node.res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename.replace(/[^\w.-]/g, '-')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      )
      event.node.res.setHeader('Cache-Control', 'no-store')

      let outputBytes = 0
      const output = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          outputBytes += chunk.byteLength
          if (outputBytes > 8_000_000) callback(new Error('PDF_EXPORT_TOO_LARGE'))
          else callback(null, chunk)
        },
      })
      completion = pipeline(doc, output, event.node.res, { signal: controller.signal })
      void completion.catch((error) => controller.abort(error))

      const dateFmt = new Intl.DateTimeFormat(languageTag(user.language), { dateStyle: 'short' })

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
          const img = await fetchImageBuffer(article.imageUrl, controller.signal)
          if (img) {
            try {
              doc.image(img, { fit: [495, 240], align: 'center' })
              doc.moveDown(1)
            } catch {
              await reportCaughtError('PDF cover omitted', new Error('PDF_IMAGE_UNSUPPORTED')).catch(() => {})
            }
          }
        }

        doc.fontSize(11).fillColor('#111827').text(stripHtml(article.content), { align: 'justify', lineGap: 2 })
      } else {
        doc
          .fontSize(18)
          .fillColor('#111827')
          .text(t('articles.exportTitle') || 'Articles export', { align: 'left' })
        doc.moveDown(1)

        articles.forEach((article, i) => {
          doc
            .fontSize(13)
            .fillColor('#2563eb')
            .text(`${i + 1}. ${article.title}`)
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

      await completion

      return null
    } catch (error) {
      controller.abort(error)
      doc.destroy()
      await completion?.catch(() => {})
      if (event.node.res.headersSent || event.node.res.destroyed) {
        await reportCaughtError('PDF export interrupted', new Error('PDF_EXPORT_INTERRUPTED'), {
          clientSiteId: membership.clientSiteId,
        }).catch(() => {})
        return null
      }
      throw error
    } finally {
      clearTimeout(timeout)
      event.node.res.removeListener('close', disconnected)
      doc.destroy()
    }
  } finally {
    activeExports -= 1
  }
})
