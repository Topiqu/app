import { generateObject } from 'ai'

const insightSchema = z.object({
  summary: z.string().min(20).max(400),
  avgScore: z.number().min(-1).max(1),
  topEmotion: z.string().nullable(),
  toxicity: z.number().min(0).max(1),
  helpfulness: z.number().min(0).max(1),
  sarcasm: z.number().min(0).max(1),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  suggestion: z.string().max(250).optional(),
  topPoints: z.array(z.string().max(75)).max(3).optional(),
})

export default defineTask({
  meta: {
    name: 'community-insights',
    description: 'Daily AI community health report for PREMIUM/CUSTOM clients',
  },
  async run() {
    const now = new Date()
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const sites = await prisma.clientSite.findMany({
      where: { plan: { in: ['PREMIUM', 'CUSTOM'] } },
      select: { id: true, name: true, communityInsight: true, language: true },
    })

    const updates = await Promise.all(
      sites.map(async (site) => {
        const comments = await prisma.comment.findMany({
          where: {
            article: { clientSiteId: site.id },
            createdAt: { gte: since },
            sentimentStatus: 'PROCESSED',
            sentiment: { not: undefined },
          },
          select: { sentiment: true, content: true },
          orderBy: { createdAt: 'desc' },
          take: 175,
        })

        if (comments.length < 5) {
          await logAction({
            action: 'COMMUNITY_INSIGHT_SKIPPED',
            clientSiteId: site.id,
            metadata: { reason: 'insufficient_comments', count: comments.length },
          })

          return prisma.clientSite.update({
            where: { id: site.id },
            data: { communityInsight: undefined, insightUpdatedAt: now },
          })
        }

        const current = calculateAverages(comments.map((c) => c.sentiment))
        const prevInsight = site.communityInsight as any
        const trend = prevInsight?.avgScore
          ? (() => {
              const delta = current.avgScore - (prevInsight.avgScore || 0)
              if (delta > 0.1) return 'up'
              if (delta < -0.1) return 'down'
              return 'stable'
            })()
          : undefined

        const sampleTexts = comments
          .slice(0, 8)
          .map((c) => c.content.slice(0, 180))
          .join('\n---\n')

        let newInsight: any = site.communityInsight
        let logMetadata: any = {}

        try {
          const { object, usage } = await generateObject({
            model: xai('grok-4-fast-reasoning'),
            system: `You are a community analyst. Respond in the client's language: ${site.language}. Summary must be 250 characters or less. Count every character. Return ONLY valid JSON. No extra text.`,
            prompt: `
              Client: ${site.name}
              Comments: ${comments.length} (24h)
              Avg score: ${current.avgScore.toFixed(2)}
              Top emotion: ${current.topEmotion || 'N/A'}
              Toxicity: ${current.toxicity.toFixed(2)}
              Helpfulness: ${current.helpfulness.toFixed(2)}
              Sarcasm: ${current.sarcasm.toFixed(2)}
              Top points: ${current.topPoints?.join(' | ') || 'N/A'}
              Trend: ${trend || 'N/A'}

              Sample comments:
              ${sampleTexts}

              Write 1–2 sentence summary (MAX 250 CHARS). Add short suggestion if needed.
            `.trim(),
            schema: insightSchema,
            temperature: 0,
            maxRetries: 1,
          })

          newInsight = {
            ...object,
            trend,
            helpfulness: current.helpfulness,
            sarcasm: current.sarcasm,
            topPoints: current.topPoints,
          }
          logMetadata = {
            usage,
            avgScore: current.avgScore,
            topEmotion: current.topEmotion,
            toxicity: current.toxicity,
            helpfulness: current.helpfulness,
            sarcasm: current.sarcasm,
            topPoints: current.topPoints,
            commentCount: comments.length,
          }

          await logAction({
            action: 'COMMUNITY_INSIGHT_GENERATED',
            clientSiteId: site.id,
            metadata: logMetadata,
          })
        } catch (err: any) {
          console.error(`[community-insights] AI failed for site ${site.id}`, err)
          await logAction({
            action: 'COMMUNITY_INSIGHT_FAILED',
            clientSiteId: site.id,
            metadata: { error: err.message, siteId: site.id },
          })

          newInsight = {
            error: true,
            reason: 'AI_VALIDATION_FAIL',
            previous: site.communityInsight,
            updatedAt: now.toISOString(),
          }
        }

        return prisma.clientSite.update({
          where: { id: site.id },
          data: {
            communityInsight: newInsight,
            insightUpdatedAt: now,
          },
        })
      }),
    )

    return { result: { updated: updates.length, timestamp: now.toISOString() } }
  },
})

function calculateAverages(sentiments: any[]) {
  const valid = sentiments.filter((s) => s && typeof s.score === 'number')
  if (!valid.length) return { avgScore: 0, topEmotion: null, toxicity: 0, helpfulness: 0, sarcasm: 0, topPoints: [] }

  const sum = { score: 0, toxicity: 0, helpfulness: 0, sarcasm: 0 }
  const emotionSums = { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0 }
  const pointCount = new Map<string, number>()

  valid.forEach((s) => {
    sum.score += s.score
    sum.toxicity += s.toxicity ?? 0
    sum.helpfulness += s.helpfulness ?? 0
    sum.sarcasm += s.sarcasm ?? 0
    if (s.point) pointCount.set(s.point, (pointCount.get(s.point) || 0) + 1)
    if (s.emotions) {
      ;(['joy', 'anger', 'sadness', 'fear', 'surprise'] as const).forEach((e) => {
        emotionSums[e] += s.emotions[e] ?? 0
      })
    }
  })

  const avgScore = sum.score / valid.length
  const toxicity = sum.toxicity / valid.length
  const helpfulness = sum.helpfulness / valid.length
  const sarcasm = sum.sarcasm / valid.length

  let topEmotion: string | null = null
  let max = 0
  for (const [e, val] of Object.entries(emotionSums)) {
    const avg = val / valid.length
    if (avg > max) {
      max = avg
      topEmotion = e
    }
  }

  const topPoints = Array.from(pointCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([point]) => point)

  return { avgScore, topEmotion, toxicity, helpfulness, sarcasm, topPoints }
}
