import { z } from 'zod'
import { LanguageSchema } from '~~/shared/siteSchemas'

const DraftBody = z.object({
  id: z.uuid().optional(),
  title: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  coverMediaId: z.uuid().nullable().optional(),
  language: LanguageSchema.optional(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const { id, title, excerpt, content, imageUrl, coverMediaId, language } = await readValidatedBody(
    event,
    DraftBody.parse,
  )

  if (!title && !content && content !== '<p></p>' && !excerpt)
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user.clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  await assertTenantMedia(user.clientSiteId, coverMediaId)

  const clientSite = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId } })
  if (!clientSite || clientSite.id !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const data = {
    title: title || '',
    excerpt: excerpt || null,
    content: content || '',
    imageUrl: imageUrl || null,
    coverMediaId: coverMediaId || null,
    language: language ?? null,
  }
  const select = {
    id: true,
    title: true,
    excerpt: true,
    content: true,
    imageUrl: true,
    coverMediaId: true,
    language: true,
    createdAt: true,
    updatedAt: true,
  } as const
  const draft = id
    ? await (async () => {
        const updated = await prisma.articleDraft.updateMany({
          where: { id, userId: user.id, clientSiteId: user.clientSiteId },
          data,
        })
        if (!updated.count) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
        return prisma.articleDraft.findUniqueOrThrow({ where: { id }, select })
      })()
    : await prisma.articleDraft.create({
        data: { ...data, userId: user.id, clientSiteId: user.clientSiteId },
        select,
      })

  return { success: true, draft }
})
