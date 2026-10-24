import { z } from 'zod'
import { DbNull } from '@zenstackhq/orm'
import { ArticleStatus } from '~~/generated/zenstack/models'

export default defineEventHandler(async (event): Promise<{ success: true; editVersion: number }> => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)
  const { expectedVersion, tagIds, ...rawBody } = z
    .object({
      expectedVersion: z.number().int().nonnegative().optional(),
      tagIds: z
        .array(z.string().uuid())
        .max(100)
        .transform((ids) => [...new Set(ids)])
        .optional(),
    })
    .passthrough()
    .parse(await readBody(event))
  delete rawBody.editVersion
  if ((requiresArticleVersion(rawBody) || tagIds !== undefined) && expectedVersion === undefined)
    throw createError({
      statusCode: 428,
      message: t('articles.editor.history.versionRequired')!,
      data: { code: 'ARTICLE_VERSION_REQUIRED' },
    })
  const mediaRightsReview =
    rawBody.mediaRightsReview === undefined
      ? undefined
      : z.object({ fingerprint: z.string(), acknowledged: z.literal(true) }).parse(rawBody.mediaRightsReview)
  delete rawBody.mediaRightsReview
  if (typeof rawBody.title === 'string' && !rawBody.title.trim())
    throw createError({ statusCode: 400, message: t('common.messages.articleTitleRequired')! })
  if (typeof rawBody.content === 'string' && !rawBody.content.trim()) rawBody.content = '<p></p>'
  if (rawBody.imageCredit === null) rawBody.imageCredit = DbNull
  const body = ArticleUpdateSchema.parse(rawBody)

  if (body.clientSiteId && body.clientSiteId !== user?.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })

  const currentDate = new Date()
  const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59)

  const previousArticle = await db.article.findUnique({
    where: { id },
    select: {
      slug: true,
      editVersion: true,
      status: true,
      publishedAt: true,
      aiInvolvement: true,
      releaseAt: true,
      articleSeriesId: true,
      seriesOrder: true,
      userId: true,
      imageUrl: true,
      coverMediaId: true,
      content: true,
      title: true,
      excerpt: true,
      answer: true,
      keyTakeaways: true,
      faq: true,
      language: true,
      clientSite: { select: { publishToWeb: true } },
    },
  })

  if (!previousArticle) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  const retainsCover =
    (body.coverMediaId === undefined || body.coverMediaId === previousArticle.coverMediaId) &&
    (body.imageUrl === undefined || body.imageUrl === previousArticle.imageUrl)
  if (!retainsCover) {
    const coverMedia =
      body.coverMediaId === undefined ? null : await assertTenantMedia(user.clientSiteId!, body.coverMediaId)
    if (!isCoverImageUrl(body.imageUrl, coverMedia))
      throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  }
  const conflict = () =>
    createError({
      statusCode: 409,
      message: t('articles.editor.history.conflict')!,
      data: { code: 'ARTICLE_EDIT_CONFLICT' },
    })
  if (expectedVersion !== undefined && expectedVersion !== previousArticle.editVersion) throw conflict()
  if (body.language !== undefined && body.language !== previousArticle.language)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  delete body.language
  if (body.slug !== undefined) {
    body.slug = articleSlug(body.slug)
    if (!body.slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  }
  const previousSlug = body.slug !== undefined && body.slug !== previousArticle.slug ? previousArticle.slug : null
  if (previousArticle.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })
  if (previousArticle.status === ArticleStatus.published) {
    if (body.status !== undefined && body.status !== ArticleStatus.published) body.releaseAt = null
    else delete body.releaseAt
  }
  if ((body.status === ArticleStatus.published || body.releaseAt) && !hasTenantScope(membership, 'ARTICLE_PUBLISH'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: ARTICLE_PUBLISH' })
  if ((body.status === ArticleStatus.published || body.releaseAt) && previousArticle.clientSite?.publishToWeb === false)
    throw createError({ statusCode: 403, message: t('common.errors.publicationChannelDisabled')! })

  const requiresPublicationReview =
    body.status === ArticleStatus.published ||
    Boolean(body.releaseAt) ||
    (body.status === undefined && previousArticle.status === ArticleStatus.published)
  if (requiresPublicationReview && !hasArticleBody(sanitizeHtml(body.content ?? previousArticle.content)))
    throw createError({ statusCode: 400, message: t('articles.editor.contentRequired')! })
  const mediaReport = requiresPublicationReview
    ? await requireMediaRightsReview(
        prisma,
        user.clientSiteId!,
        {
          imageUrl: body.imageUrl === undefined ? previousArticle.imageUrl : body.imageUrl,
          coverMediaId: body.coverMediaId === undefined ? previousArticle.coverMediaId : body.coverMediaId,
          content: body.content === undefined ? previousArticle.content : body.content,
        },
        mediaRightsReview,
        { articleId: id, language: previousArticle.language },
      )
    : null

  if (body.releaseAt) {
    const releaseDate = new Date(body.releaseAt)
    const isUnchanged =
      previousArticle.releaseAt && new Date(previousArticle.releaseAt).getTime() === releaseDate.getTime()

    if (!isUnchanged && (isNaN(releaseDate.getTime()) || releaseDate < currentDate || releaseDate > maxDate)) {
      throw createError({ statusCode: 400, message: t('common.errors.invalidReleaseDate')! })
    }
  }

  if (body.releaseAt && new Date(body.releaseAt).getTime() > currentDate.getTime()) body.status = ArticleStatus.draft
  else if (body.status === ArticleStatus.published) body.releaseAt = null

  let newSeriesOrder = previousArticle.seriesOrder
  if (body.articleSeriesId !== undefined) {
    if (body.articleSeriesId === null) {
      newSeriesOrder = 0
    } else if (body.articleSeriesId !== previousArticle.articleSeriesId) {
      const lastArticle = await db.article.findFirst({
        where: {
          articleSeriesId: body.articleSeriesId,
          clientSiteId: user.clientSiteId,
        },
        orderBy: { seriesOrder: 'desc' },
        select: { seriesOrder: true },
      })
      newSeriesOrder = (lastArticle?.seriesOrder ?? 0) + 1
    }
  }

  const attributedContent = body.content ? await applyMediaAttributions(user.clientSiteId!, body.content) : body.content
  const content = attributedContent ? stampHeadingIds(attributedContent) : attributedContent
  if (body.coverMediaId !== undefined) {
    const mediaCoverCredit = await coverCreditFromMedia(user.clientSiteId!, body.coverMediaId)
    if (mediaCoverCredit) body.imageCredit = JSON.parse(JSON.stringify(mediaCoverCredit))
  }

  const data: any = {
    ...body,
    seriesOrder: newSeriesOrder,
  }
  if ('releaseAt' in body) {
    data.releaseAt = body.releaseAt ? new Date(body.releaseAt) : null
  }
  if (body.content) data.content = sanitizeHtml(content || '')
  if (previousArticle.status !== ArticleStatus.published && body.status === ArticleStatus.published) {
    data.publishedAt = previousArticle.publishedAt ?? currentDate
  }
  if (previousArticle.aiInvolvement === 'FULL' && data.content && data.content !== previousArticle.content) {
    data.aiInvolvement = 'ASSIST'
  }
  // Server-owned: edits before the first publication are not modifications any reader saw.
  delete data.contentUpdatedAt
  const textChanged = changesReaderText(previousArticle, data)
  if (previousArticle.publishedAt && textChanged) data.contentUpdatedAt = currentDate

  // Compare reader text before replacing JSON null with ZenStack's database-null sentinel.
  if (data.faq === null) data.faq = DbNull

  const article = await db
    .$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        { editVersion: number }[]
      >`SELECT "editVersion" FROM "Article" WHERE id = ${id} AND "clientSiteId" = ${user.clientSiteId} FOR UPDATE`
      if (!locked || locked.editVersion !== (expectedVersion ?? previousArticle.editVersion)) throw conflict()
      await tx.$queryRaw`SELECT set_config('topiqu.actor_id', ${user.id}, true), set_config('topiqu.actor_name', ${user.name}, true)`
      if (tagIds !== undefined) {
        const validTags = await tx.tag.count({ where: { id: { in: tagIds }, clientSiteId: user.clientSiteId! } })
        if (validTags !== tagIds.length)
          throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
        const existing = await tx.articleTag.findMany({ where: { articleId: id }, select: { tagId: true } })
        if (existing.length !== tagIds.length || existing.some((tag) => !tagIds.includes(tag.tagId)))
          await tx.$queryRaw`SELECT set_config('topiqu.tags_changed_article_id', ${id}, true)`
      }
      if (typeof data.content === 'string') {
        data.content = sanitizeHtml(
          await syncArticlePolls(tx as unknown as Parameters<typeof syncArticlePolls>[0], id, data.content),
        )
      }
      const updated = await tx.article.update({ where: { id }, data })
      if (tagIds !== undefined) {
        await tx.articleTag.deleteMany({ where: { articleId: id, tagId: { notIn: tagIds } } })
        if (tagIds.length)
          await tx.articleTag.createMany({
            data: tagIds.map((tagId) => ({ articleId: id, tagId })),
            skipDuplicates: true,
          })
      }
      // Only an address readers could have seen needs to keep working. A live article always wins
      // the lookup, so a stale redirect is harmless until the slug is freed again; then it is re-aimed.
      if (previousSlug && previousArticle.publishedAt)
        await tx.articleSlugRedirect.upsert({
          where: { slug_clientSiteId: { slug: previousSlug, clientSiteId: updated.clientSiteId } },
          create: { slug: previousSlug, articleId: updated.id, clientSiteId: updated.clientSiteId },
          update: { articleId: updated.id },
        })
      return updated
    })
    .catch((error) => {
      if (isUniqueViolation(error)) throw createError({ statusCode: 409, message: t('articles.editor.slugConflict')! })
      throw error
    })

  const usageArticle = await prisma.article.findFirst({
    where: { id: article.id, clientSiteId: user.clientSiteId! },
    select: { imageUrl: true, coverMediaId: true, content: true, language: true },
  })
  if (usageArticle)
    await syncArticleMediaUsages(prisma, {
      clientSiteId: user.clientSiteId!,
      articleId: article.id,
      language: usageArticle.language,
      imageUrl: usageArticle.imageUrl,
      coverMediaId: usageArticle.coverMediaId,
      content: usageArticle.content,
    })

  if (article.status === ArticleStatus.published) {
    await syncArticleTranslationQueue(db, article.id, user.clientSiteId, { contentChanged: 'content' in data })
  }

  if (mediaReport) {
    await createMediaRightsSnapshot(prisma, {
      articleId: article.id,
      clientSiteId: user.clientSiteId!,
      language: article.language,
      report: mediaReport,
      confirmedById: user.id,
    })
  }

  // Covers publishing, unpublishing and edits to an already-live article. A
  // draft-only edit is not in any listing, so it must not flush the tenant's cache.
  if (article.status === ArticleStatus.published || previousArticle.status === ArticleStatus.published) {
    await invalidateFeed(user.clientSiteId)
  }

  await logAction({
    action: 'ARTICLE_UPDATE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: {
      articleId: id,
      updatedFields: Object.keys(data),
      previousStatus: previousArticle.status,
      status: article.status,
      previousReleaseAt: previousArticle.releaseAt?.toISOString() ?? null,
      releaseAt: article.releaseAt?.toISOString() ?? null,
    },
  })

  if (article.status === ArticleStatus.published && previousArticle?.status === ArticleStatus.draft) {
    await db.$transaction((tx) => notifyArticlePublished(tx, article))
  }

  const wasPublished = previousArticle.status === ArticleStatus.published
  const isPublished = article.status === ArticleStatus.published
  if (wasPublished || isPublished)
    await enqueueArticleWebhook(
      isPublished ? (wasPublished ? 'ARTICLE_UPDATED' : 'ARTICLE_PUBLISHED') : 'ARTICLE_UNPUBLISHED',
      { id: article.id, clientSiteId: article.clientSiteId, slug: article.slug, language: article.language },
    )

  // Tag or cover edits change nothing an engine indexes, so they are not announced.
  if ((wasPublished || isPublished) && (wasPublished !== isPublished || textChanged || previousSlug)) {
    const removedPaths = [
      ...(previousSlug && previousArticle.publishedAt ? [articlePath(article.language, previousSlug)] : []),
      ...(isPublished ? [] : await articlePublicPaths(article.id, article.clientSiteId)),
    ]
    void announceArticle(article.id, article.clientSiteId, removedPaths)
  }

  return { success: true, editVersion: article.editVersion }
})
