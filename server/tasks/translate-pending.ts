import type { ClientPlan } from '@prisma/client'

const TRANSLATION_PLANS: ClientPlan[] = ['PRO', 'PREMIUM', 'CUSTOM']
const BATCH_SIZE = 10
const MIN_TRANSLATION_TOKENS = 500

export default defineTask({
  meta: {
    name: 'translate-pending',
    description: 'Translate queued ArticleTranslation rows (PENDING/STALE) via xAI; AUTO publishes, HYBRID holds for review',
  },
  async run() {
    const now = new Date()

    const candidates = await prisma.articleTranslation.findMany({
      where: {
        status: { in: ['PENDING', 'STALE'] },
        deletedAt: null,
        article: { status: 'published', deletedAt: null },
        clientSite: {
          enableAi: true,
          plan: { in: TRANSLATION_PLANS },
          translationMode: { in: ['AUTO', 'HYBRID'] },
        },
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (!candidates.length) {
      return { result: { processed: 0, failed: 0, skipped: 0, total: 0, timestamp: now.toISOString() } }
    }

    let processed = 0
    let failed = 0
    let skipped = 0

    for (const { id } of candidates) {
      // Atomic per-row claim: only the run that flips it out of a claimable state owns it,
      // so concurrent cron runs / manual triggers can never double-translate the same row.
      const claim = await prisma.articleTranslation.updateMany({
        where: { id, status: { in: ['PENDING', 'STALE'] } },
        data: { status: 'TRANSLATING' },
      })
      if (claim.count !== 1) continue

      const row = await prisma.articleTranslation.findUnique({
        where: { id },
        select: {
          id: true,
          language: true,
          clientSiteId: true,
          article: { select: { id: true, title: true, excerpt: true, content: true } },
          clientSite: { select: { tokenRemaining: true, translationMode: true } },
        },
      })

      if (!row || !row.article || !row.clientSite) {
        await prisma.articleTranslation.update({
          where: { id },
          data: { status: 'FAILED', error: 'Source article or tenant missing' },
        })
        failed++
        continue
      }

      // Out of budget: release the claim back to PENDING so it retries once the tenant tops up,
      // instead of paying xAI for a translation we can't charge for.
      if (!row.clientSite.tokenRemaining || row.clientSite.tokenRemaining < MIN_TRANSLATION_TOKENS) {
        await prisma.articleTranslation.update({ where: { id }, data: { status: 'PENDING' } })
        skipped++
        continue
      }

      try {
        const { usage, slug: baseSlug, ...translated } = await generateTranslation(row.article, row.language)

        await consumeClientTokens(
          row.clientSiteId,
          usage.totalTokens || 0,
          'TRANSLATE_ARTICLE',
          { articleId: row.article.id, translationId: row.id, targetLang: row.language, usage, auto: true },
        )

        const slug = await dedupeTranslationSlug(prisma, baseSlug, row.clientSiteId, row.language, row.article.id)
        const finalStatus = row.clientSite.translationMode === 'AUTO' ? 'PUBLISHED' : 'READY'

        await prisma.articleTranslation.update({
          where: { id },
          data: {
            slug,
            title: translated.title,
            excerpt: translated.excerpt,
            content: sanitizeHtml(translated.content),
            status: finalStatus,
            source: 'AI',
            model: 'grok-4-1-fast',
            usage,
            error: null,
            translatedAt: new Date(),
          },
        })

        logAction({
          action: 'TRANSLATE_ARTICLE',
          clientSiteId: row.clientSiteId,
          metadata: { articleId: row.article.id, translationId: row.id, targetLang: row.language, status: finalStatus, usage },
        })
        processed++
      } catch (e: any) {
        await prisma.articleTranslation.update({
          where: { id },
          data: { status: 'FAILED', error: (e?.message || 'unknown').slice(0, 1000) },
        })
        logAction({
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
