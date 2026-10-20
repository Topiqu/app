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
      where: { status: 'TRANSLATING', updatedAt: { lt: new Date(now.getTime() - 30 * 60_000) } },
      data: { status: 'PENDING', error: null },
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
      select: { id: true },
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
    const skipped = 0

    for (const { id } of candidates) {
      const claimedAt = new Date()
      // Atomic per-row claim: only the run that flips it out of a claimable state owns it,
      // so concurrent cron runs / manual triggers can never double-translate the same row.
      const claim = await prisma.articleTranslation.updateMany({
        where: { id, status: { in: ['PENDING', 'STALE'] } },
        data: { status: 'TRANSLATING', updatedAt: claimedAt },
      })
      if (claim.count !== 1) continue

      const row = await prisma.articleTranslation.findUnique({
        where: { id },
        select: {
          id: true,
          language: true,
          clientSiteId: true,
          article: {
            select: {
              id: true,
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
          data: { status: 'FAILED', error: 'Source article or tenant missing' },
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
        })

        const slug = await dedupeTranslationSlug(prisma, baseSlug, row.clientSiteId, row.language, row.article.id)
        const finalStatus =
          row.clientSite.translationMode === 'AUTO' && row.clientSite.publishToWeb ? 'PUBLISHED' : 'READY'

        const updatedTranslation = await prisma.$transaction(async (tx) => {
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
            },
          })
          if (!saved.count) return false
          await syncArticleMediaUsages(tx, {
            clientSiteId: row.clientSiteId,
            articleId: row.article.id,
            articleTranslationId: id,
            language: row.language,
            content: sanitizeHtml(translated.content),
          })
          return true
        })
        if (!updatedTranslation) continue

        if (finalStatus === 'PUBLISHED') await invalidateFeed(row.clientSiteId)

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
        if (finalStatus === 'PUBLISHED') {
          await announceArticle(row.article.id, row.clientSiteId)
        }
        processed++
      } catch (e: any) {
        await prisma.articleTranslation.updateMany({
          where: { id, status: 'TRANSLATING', updatedAt: claimedAt },
          data: {
            status: 'FAILED',
            error: (e?.message || 'unknown').slice(0, 1000),
          },
        })
        await logAction({
          action: 'TRANSLATE_FAILED',
          clientSiteId: row.clientSiteId,
          metadata: { articleId: row.article.id, translationId: row.id, error: e?.message },
        })
        failed++
      }
    }

    return { result: { processed, failed, skipped, total: candidates.length, timestamp: now.toISOString() } }
  },
})
