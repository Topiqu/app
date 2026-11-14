import type { H3Event } from 'h3'

import { aiAllowanceMessage } from '~~/server/utils/ai/allowanceError'
import { ArticleImagePickStatus, ArticleStatus, type ArticleImagePick } from '~~/generated/zenstack/models'

type Translate = (key: string) => string | undefined
type PickFields = Pick<
  ArticleImagePick,
  'status' | 'startedAt' | 'articleVersion' | 'content' | 'imageUrl' | 'coverMediaId' | 'error'
>

// A pick still running after this died with the server that ran it, and may start again.
const LOST_AFTER_MS = 10 * 60_000
const lostBefore = () => new Date(Date.now() - LOST_AFTER_MS)

/** The article behind `/api/articles/:id/images`, if the signed-in editor may change it. */
export async function imagePickArticle(
  event: H3Event,
  { user, membership }: Awaited<ReturnType<typeof requireTenantScope>>,
  t: Translate,
) {
  const id = getRouterParam(event, 'id')
  const db = await getEnhancedPrisma(user)
  const article = id
    ? await db.article.findUnique({
        where: { id },
        select: {
          id: true,
          clientSiteId: true,
          userId: true,
          status: true,
          editVersion: true,
          title: true,
          excerpt: true,
          content: true,
          language: true,
        },
      })
    : null
  if (!article || article.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (article.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })
  return { db, article }
}

export const imagePickView = (pick: PickFields, t: Translate) => {
  const lost = pick.status === ArticleImagePickStatus.RUNNING && pick.startedAt <= lostBefore()
  return {
    status: lost ? ArticleImagePickStatus.FAILED : pick.status,
    articleVersion: pick.articleVersion,
    content: pick.content,
    imageUrl: pick.imageUrl,
    coverMediaId: pick.coverMediaId,
    error: lost ? t('common.messages.operationFailed')! : pick.error,
  }
}

/**
 * Starts picking the pictures in the background, unless a pick of this article is already running.
 * Returns the running pick; `false` when the editor's rate limit is spent.
 */
export async function startImagePick(
  event: H3Event,
  { db, article }: Awaited<ReturnType<typeof imagePickArticle>>,
  userId: string,
  t: Translate,
) {
  const running = () =>
    db.articleImagePick.findFirst({
      where: { articleId: article.id, status: ArticleImagePickStatus.RUNNING, startedAt: { gt: lostBefore() } },
    })
  const current = await running()
  if (current) return imagePickView(current, t)
  if (!(await consumeRateLimit(`article-images:${article.clientSiteId}:${userId}`, 20, 60 * 60))) return false

  const fields: PickFields & { clientSiteId: string; userId: string } = {
    clientSiteId: article.clientSiteId,
    userId,
    status: ArticleImagePickStatus.RUNNING,
    startedAt: new Date(),
    articleVersion: article.editVersion,
    content: null,
    imageUrl: null,
    coverMediaId: null,
    error: null,
  }
  // The claim is the guard against paying twice: only a finished or lost pick is taken over.
  const { count } = await db.articleImagePick.updateMany({
    where: {
      articleId: article.id,
      OR: [{ status: { not: ArticleImagePickStatus.RUNNING } }, { startedAt: { lte: lostBefore() } }],
    },
    data: fields,
  })
  if (!count)
    try {
      await db.articleImagePick.create({ data: { articleId: article.id, ...fields } })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const other = await running()
      if (other) return imagePickView(other, t)
      throw error
    }

  // A newer pick of the same article owns the row once it starts; this one then saves nothing.
  const settle = (data: Partial<PickFields>) =>
    db.articleImagePick.updateMany({ where: { articleId: article.id, startedAt: fields.startedAt }, data })
  const pick = async () => {
    try {
      return await withAiAllowance(article.clientSiteId, 'EDIT', () =>
        withAiSpend(article.clientSiteId, () =>
          repickArticleImages(article.clientSiteId, {
            ...article,
            published: article.status === ArticleStatus.published,
          }),
        ),
      )
    } catch (error) {
      const message = aiAllowanceMessage(error, t) ?? t('common.messages.operationFailed')!
      await settle({ status: ArticleImagePickStatus.FAILED, error: message }).catch(() => {})
      throw error
    }
  }
  const work = pick()
    .then(async ({ tokens, ...picked }) => {
      await settle({ status: ArticleImagePickStatus.READY, ...picked })
      await recordAiUsage(article.clientSiteId, tokens, 'ARTICLE_IMAGES', { articleId: article.id }, event, userId)
    })
    .catch((error: unknown) =>
      reportCaughtError('Picking article images failed', error, {
        articleId: article.id,
        clientSiteId: article.clientSiteId,
      }),
    )
  event.waitUntil(work)
  return imagePickView(fields, t)
}
