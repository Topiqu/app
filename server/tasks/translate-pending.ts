import type { ClientPlan } from '~~/generated/zenstack/models'

const TRANSLATION_PLANS: ClientPlan[] = ['PRO', 'PREMIUM', 'CUSTOM']
const BATCH_SIZE = 10

export default defineMonitoredTask({
  meta: {
    name: 'translate-pending',
    description:
      'Translate queued ArticleTranslation rows (PENDING/STALE) via the registry translation model; AUTO publishes, HYBRID holds for review',
  },
  async run() {
    const now = new Date()
    await prisma.articleTranslation.updateMany({
      where: {
        status: 'TRANSLATING',
        updatedAt: { lt: new Date(now.getTime() - 30 * 60_000) },
        article: { status: 'published' },
        clientSite: { translationMode: { in: ['AUTO', 'HYBRID'] } },
      },
      data: { status: 'PENDING', translationStartedAt: null, error: null, updatedAt: now },
    })
    await prisma.articleTranslation.updateMany({
      where: { status: 'TRANSLATING', updatedAt: { lt: new Date(now.getTime() - 30 * 60_000) } },
      data: { status: 'FAILED', translationStartedAt: null, error: 'TRANSLATION_TIMEOUT', updatedAt: now },
    })
    await prisma.articleTranslation.updateMany({
      where: { status: 'PUBLISHED', translationStartedAt: { lt: new Date(now.getTime() - 30 * 60_000) } },
      data: { translationStartedAt: null, error: 'TRANSLATION_TIMEOUT', updatedAt: now },
    })

    const candidates = await prisma.articleTranslation.findMany({
      where: {
        status: { in: ['PENDING', 'STALE'] },
        deletedAt: null,
        article: { status: 'published', deletedAt: null },
        clientSite: {
          deletedAt: null,
          plan: { in: TRANSLATION_PLANS },
          translationMode: { in: ['AUTO', 'HYBRID'] },
          ...activeFeatureFilter('AI'),
        },
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
      select: { id: true, updatedAt: true },
    })

    if (!candidates.length) {
      const queued = await prisma.articleTranslation.count({
        where: { status: { in: ['PENDING', 'STALE'] }, deletedAt: null },
      })
      return {
        result: {
          processed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
          queuedButIneligible: queued,
          timestamp: now.toISOString(),
        },
      }
    }

    let processed = 0
    let failed = 0
    let skipped = 0

    for (const { id, updatedAt } of candidates) {
      const claimedAt = nextTranslationVersion(updatedAt)
      // Atomic per-row claim: only the run that flips it out of a claimable state owns it,
      // so concurrent cron runs / manual triggers can never double-translate the same row.
      const claim = await prisma.articleTranslation.updateMany({
        where: { id, updatedAt, status: { in: ['PENDING', 'STALE'] } },
        data: { status: 'TRANSLATING', translationStartedAt: claimedAt, updatedAt: claimedAt },
      })
      if (claim.count !== 1) {
        skipped++
        continue
      }

      const row = await prisma.articleTranslation.findUnique({
        where: { id },
        select: {
          id: true,
          language: true,
          clientSiteId: true,
          article: {
            select: {
              id: true,
              editVersion: true,
              title: true,
              excerpt: true,
              content: true,
              answer: true,
              keyTakeaways: true,
              faq: true,
            },
          },
          clientSite: { select: { translationMode: true, publishToWeb: true } },
        },
      })

      if (!row || !row.article || !row.clientSite) {
        await prisma.articleTranslation.updateMany({
          where: { id, status: 'TRANSLATING', updatedAt: claimedAt },
          data: {
            status: 'FAILED',
            translationStartedAt: null,
            error: 'Source article or tenant missing',
            updatedAt: nextTranslationVersion(claimedAt),
          },
        })
        failed++
        continue
      }

      try {
        const { usage, slug: baseSlug, ...translated } = await generateTranslation(row.article, row.language)

        await recordAiUsage(row.clientSiteId, usage.totalTokens || 0, 'TRANSLATE_ARTICLE', {
          articleId: row.article.id,
          translationId: row.id,
          targetLang: row.language,
          usage,
          auto: true,
        }).catch((error: unknown) =>
          reportCaughtError('Translation usage recording failed', error, {
            clientSiteId: row.clientSiteId,
            articleId: row.article.id,
            translationId: id,
          }),
        )

        const slug = await dedupeTranslationSlug(prisma, baseSlug, row.clientSiteId, row.language, row.article.id)
        const finalStatus =
          row.clientSite.translationMode === 'AUTO' && row.clientSite.publishToWeb ? 'PUBLISHED' : 'READY'

        const updatedTranslation = await prisma.$transaction(async (tx) => {
          // Share the source row lock with article edits until the translation is committed.
          const source = await tx.$queryRaw<{ editVersion: number }[]>`
            SELECT "editVersion" FROM "Article"
            WHERE "id" = ${row.article.id} AND "clientSiteId" = ${row.clientSiteId}
              AND "status" = 'published' AND "deletedAt" IS NULL
            FOR SHARE
          `
          if (source[0]?.editVersion !== row.article.editVersion) return false
          const saved = await tx.articleTranslation.updateMany({
            where: {
              id,
              status: 'TRANSLATING',
              updatedAt: claimedAt,
              clientSite: {
                deletedAt: null,
                plan: { in: TRANSLATION_PLANS },
                translationMode: row.clientSite.translationMode,
                publishToWeb: row.clientSite.publishToWeb,
                ...activeFeatureFilter('AI'),
              },
              article: { status: 'published', deletedAt: null },
            },
            data: {
              slug,
              title: translated.title,
              excerpt: translated.excerpt,
              content: sanitizeHtml(translated.content),
              answer: translated.answer,
              keyTakeaways: translated.keyTakeaways,
              faq: translated.faq,
              status: finalStatus,
              source: 'AI',
              model: aiModelId('translation'),
              usage: toDatabaseJson(usage),
              error: null,
              translatedAt: new Date(),
              translationStartedAt: null,
              updatedAt: nextTranslationVersion(claimedAt),
            },
          })
          if (!saved.count) return false
          return true
        })
        if (!updatedTranslation) {
          await prisma.articleTranslation.updateMany({
            where: { id, status: 'TRANSLATING', updatedAt: claimedAt },
            data: {
              status: 'STALE',
              translationStartedAt: null,
              error: null,
              updatedAt: nextTranslationVersion(claimedAt),
            },
          })
          skipped++
          continue
        }

        if (finalStatus === 'PUBLISHED') await invalidateFeed(row.clientSiteId)

        await syncArticleMediaUsages(prisma, {
          clientSiteId: row.clientSiteId,
          articleId: row.article.id,
          articleTranslationId: id,
          language: row.language,
          content: sanitizeHtml(translated.content),
        })

        processed++
        try {
          await logAction({
            action: 'TRANSLATE_ARTICLE',
            clientSiteId: row.clientSiteId,
            metadata: {
              articleId: row.article.id,
              translationId: row.id,
              targetLang: row.language,
              status: finalStatus,
              usage,
            },
          })
          if (finalStatus === 'PUBLISHED') await announceArticle(row.article.id, row.clientSiteId)
        } catch (error) {
          await reportCaughtError('Translation notification or audit failed after persistence', error, {
            clientSiteId: row.clientSiteId,
            articleId: row.article.id,
            translationId: id,
          })
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message.slice(0, 1000) : 'Translation failed'
        await prisma.articleTranslation.updateMany({
          where: { id, status: 'TRANSLATING', updatedAt: claimedAt },
          data: {
            status: 'FAILED',
            translationStartedAt: null,
            error: message,
            updatedAt: nextTranslationVersion(claimedAt),
          },
        })
        await logAction({
          action: 'TRANSLATE_FAILED',
          clientSiteId: row.clientSiteId,
          metadata: { articleId: row.article.id, translationId: row.id, error: message },
        }).catch((auditError: unknown) =>
          reportCaughtError('Translation failure audit unavailable', auditError, {
            clientSiteId: row.clientSiteId,
            translationId: id,
          }),
        )
        failed++
      }
    }

    return { result: { processed, failed, skipped, total: candidates.length, timestamp: now.toISOString() } }
  },
})
