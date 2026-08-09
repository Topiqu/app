import type { EventStream } from 'h3'

import slugify from 'slugify'
import { linkableSources } from '~~/shared/utils/articleSources'
import { consumeClientTokens } from '~~/server/utils/consumeTokens'

interface GlobalThis {
  eventStreams?: Map<string, Set<EventStream>>
}

declare const globalThis: GlobalThis

const generateUniqueSlug = async (ctx: any, title: string, clientSiteId: string): Promise<string> => {
  const base = slugify(title, { lower: true, strict: true, trim: true })

  const existing = await ctx.article.findMany({
    where: { clientSiteId, slug: { startsWith: base } },
    select: { slug: true },
    orderBy: { slug: 'desc' },
  })

  if (!existing.length) return base

  const suffixes = existing
    .map((a: { slug: string }) => {
      const match = a.slug.match(new RegExp(`^${base}-(\\d+)$`))
      return match ? parseInt(match[1]!) : 0
    })
    .filter((n: number) => n > 0)

  const max = suffixes.length ? Math.max(...suffixes) : 0
  return `${base}-${max + 1}`
}

const MIN_TOKENS = 7000

/** Why each scheduled site was left out of this run — `not_due` is the only benign answer. */
const skippedSites = async (pickedIds: string[], now: Date) => {
  const scheduled = await prisma.clientSite.findMany({
    where: { generationFrequency: { in: ['DAILY', 'WEEKLY'] }, id: { notIn: pickedIds } },
    select: {
      id: true,
      name: true,
      tokenRemaining: true,
      lastGeneratedAt: true,
      generationFrequency: true,
      features: { where: { isActive: true, feature: { code: 'ARTICLE_CRONS' } }, select: { id: true } },
    },
  })

  return scheduled.map((site) => ({
    clientSiteId: site.id,
    name: site.name,
    lastGeneratedAt: site.lastGeneratedAt?.toISOString() ?? null,
    reason: !site.features.length
      ? 'feature_inactive'
      : (site.tokenRemaining ?? 0) <= MIN_TOKENS
        ? 'insufficient_tokens'
        : 'not_due',
  }))
}

const processClient = async (client: any) => {
  const clientSiteId = client.id
  const defaultLang = client.language

  const topicInput = {
    focus: client.focus,
    audience: client.audience,
    keywords: client.keywords,
    language: defaultLang,
    recentExcerpts: client.articles.map((a: any) => a.excerpt).filter(Boolean),
    suggestion: client.communityInsight?.suggestion,
  }

  // Topic first, then the article. The writer used to receive the whole selection template as its
  // prompt, which meant the research step searched the template instead of a subject — and ran
  // before any subject existed. Picking here also lets the model say whether the topic actually
  // needs live facts, so evergreen pieces skip the web-search call entirely.
  let topic: ArticleTopic | null = null
  let topicTokens = 0
  try {
    const picked = await pickArticleTopic(topicInput)
    topic = picked.topic
    topicTokens = picked.usage.totalTokens ?? 0
  } catch (err) {
    await logAction({
      action: 'CRON_TOPIC_SELECTION_FAILED',
      clientSiteId,
      metadata: { error: (err as any).message },
    })
  }

  // If selection failed we fall back to the previous behaviour — the writer picks the topic
  // itself from the same rules — rather than skipping the client's run entirely.
  const topicBlock = topic
    ? `## TOPIC
  Topic: ${topic.topic}
  Angle: ${topic.angle}`
    : `## TOPIC RULES
  - Do NOT create an article that is semantically similar to previous ones.
  - Similarity = same topic, argument, or thesis, not wording.
  - Past article summaries (avoid these topics):
  ${topicInput.recentExcerpts.map((excerpt: string) => `- ${excerpt}`).join('\n') || 'none'}

  ## COMMUNITY INSIGHT (optional)
  ${topicInput.suggestion || 'none'}
  If relevant AND non-duplicate, prefer it as topic.`

  const prompt = `
  Generate a blog article for the client.

  Audience: ${client.audience || 'general'}
  Focus: ${client.focus || 'general topics'}
  Keywords: ${client.keywords?.join(', ') ?? 'none'}

  ${topicBlock}

  ## ARTICLE REQUIREMENTS
  - Catchy title
  - Engaging perex
  - Structured sections with headings
  - Return "tags" as array of tag IDs

  ## LANGUAGE RULE
  Default: ${defaultLang.toUpperCase()}
  If ANY input (audience, keywords, focus) contains another language, write entire article in that language.

  Respond ONLY in valid JSON (schema required).
  `.trim()

  let generated: any, usage: any
  try {
    // Never `undefined` here: that would research the prompt, and the prompt is a template.
    ;({ usage, ...generated } = await generateArticle(clientSiteId, prompt, {
      research: topic ? researchRequest(topic) : false,
    }))
  } catch (err) {
    await logAction({
      action: 'CRON_GENERATE_ARTICLE_FAILED',
      clientSiteId,
      metadata: { error: (err as any).message, topic: topic?.topic },
    })
    return
  }

  const tokens = (usage.totalTokens ?? 0) + topicTokens + (generated.researchTokens ?? 0)
  if (tokens <= 0) return

  try {
    await consumeClientTokens(clientSiteId, tokens, 'CRON_GENERATE_ARTICLE', {
      title: generated.title,
      tags: generated.tags,
    })
  } catch (err: any) {
    await logAction({
      action: 'CRON_GENERATE_ARTICLE_INSUFFICIENT_TOKENS',
      clientSiteId,
      metadata: { required: tokens, error: err.message },
    })
    return
  }

  const metrics = calculateArticleMetrics(generated.content, client.humanHourlyRateUsd, client.humanWordsPerHour)

  await logAction({
    action: 'CRON_GENERATE_ARTICLE',
    clientSiteId,
    metadata: {
      ...generated,
      usage,
      metrics,
      topic: topic ? { ...topic, researched: researchRequest(topic) !== false } : null,
      topicTokens,
    },
  })

  const status = client.autoRelease ? 'published' : 'draft'

  const article = await prisma.$transaction(async (ctx: any) => {
    const slug = await generateUniqueSlug(ctx, generated.title, clientSiteId)

    const article = await ctx.article.create({
      select: {
        id: true,
        title: true,
        content: true,
        userId: true,
        user: { select: { username: true, language: true, role: true } },
      },
      data: {
        title: generated.title,
        excerpt: generated.perex,
        slug,
        userId: client.users[0]?.id || 'system',
        content: sanitizeHtml(generated.content),
        clientSiteId,
        status,
        aiInvolvement: 'FULL',
        // The streaming path carries these through `applyAiFinal`; the cron writes the row itself
        // and dropped them, so every cron article shipped with a NULL `sources` column.
        sources: linkableSources(generated.sources),
        // Same omission, and it silently wasted the work: `finalizeArticle` already fetched or
        // generated the cover before this row was written, so the cost was paid either way.
        imageUrl: generated.articleImageUrl || null,
        imageCredit: generated.articleImageCredit ?? undefined,
        totalWords: metrics.totalWords,
        savedAmount: metrics.savedAmount,
        savedTimeMinutes: metrics.savedTimeMinutes,
      },
    })

    await ctx.articleTag.createMany({
      data: generated.tags.map((tagId: string) => ({ articleId: article.id, tagId })),
      skipDuplicates: true,
    })

    return article
  })

  const contentWithPolls = await syncArticlePolls(
    prisma as unknown as Parameters<typeof syncArticlePolls>[0],
    article.id,
    article.content,
  )
  if (contentWithPolls !== article.content) {
    await prisma.article.update({ where: { id: article.id }, data: { content: sanitizeHtml(contentWithPolls) } })
  }

  await prisma.clientSite.update({
    where: { id: clientSiteId },
    data: { lastGeneratedAt: new Date() },
  })

  if (status === 'published') {
    await syncArticleTranslationQueue(prisma, article.id, clientSiteId)
    await invalidateFeed(clientSiteId)

    await logAction({
      action: 'CRON_ARTICLE_PUBLISHED',
      userId: article.userId,
      clientSiteId,
      metadata: { articleId: article.id, title: article.title, autoReleased: client.autoRelease },
    })

    const sendNotifications = async () => {
      if (article.user?.role !== 'ai') {
        const translate = await getServerTranslator(article.user?.language || 'cs')
        const authorMessage = translate('common.notifications.articlePublished', [article.title])

        const authorNotif = await prisma.notification.create({
          data: {
            message: authorMessage!,
            userId: article.userId,
            articleId: article.id,
            type: 'ARTICLE_PUBLISHED',
          },
        })

        const authorStreamKey = `notifications:${authorNotif.userId}`
        const authorStreams = globalThis.eventStreams?.get(authorStreamKey)
        if (authorStreams) {
          authorStreams.forEach((s) => s.push(JSON.stringify({ ...authorNotif, count: 1 })))
        }
      }

      const followers = await prisma.follow.findMany({
        where: {
          followedId: article.userId,
          follower: { allowNotifs: true },
        },
        select: {
          followerId: true,
          follower: { select: { language: true } },
        },
      })

      if (followers.length === 0) return

      const uniqueLangs = [...new Set(followers.map((f) => f.follower.language || 'cs'))]
      const username = article.user?.username ?? 'Autor'

      const langTranslations = await Promise.all(
        uniqueLangs.map(async (lang) => {
          const translate = await getServerTranslator(lang)
          const message = translate('common.notifications.newArticleFromFollowed', [username, article.title])!
          return { lang, message }
        }),
      )

      const langToMessage = Object.fromEntries(langTranslations.map((t) => [t.lang, t.message]))

      const notifications = followers.map((f) => ({
        message: langToMessage[f.follower.language || 'cs']!,
        userId: f.followerId,
        articleId: article.id,
        type: 'ARTICLE_PUBLISHED' as const,
      }))

      const BATCH_SIZE = 100

      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE)

        await prisma.notification.createMany({
          data: batch,
          skipDuplicates: true,
        })

        batch.forEach((n) => {
          const key = `notifications:${n.userId}`
          const streams = globalThis.eventStreams?.get(key)
          if (streams) {
            streams.forEach((s) => s.push(JSON.stringify({ ...n, count: 1 })))
          }
        })
      }
    }

    sendNotifications().catch((err) => {
      console.error('[generate-article] Notification error:', err)
    })
  } else {
    await logAction({
      action: 'CRON_ARTICLE_SAVED_AS_DRAFT',
      userId: article.userId,
      clientSiteId,
      metadata: { articleId: article.id, title: article.title },
    })
  }
}

export default defineMonitoredTask({
  meta: {
    name: 'generate-article',
    description: 'Generates articles using AI',
  },
  async run() {
    const now = new Date()

    const clients = await prisma.clientSite.findMany({
      select: {
        id: true,
        humanHourlyRateUsd: true,
        humanWordsPerHour: true,
        autoRelease: true,
        audience: true,
        keywords: true,
        focus: true,
        language: true,
        generationFrequency: true,
        communityInsight: true,
        lastGeneratedAt: true,
        articles: { select: { excerpt: true }, orderBy: { createdAt: 'desc' }, take: 30 },
        users: { select: { id: true }, orderBy: { role: 'desc' }, take: 1 },
      },
      where: {
        tokenRemaining: { gt: MIN_TOKENS },
        generationFrequency: { in: ['DAILY', 'WEEKLY'] },
        ...activeFeatureFilter('ARTICLE_CRONS'),
        OR: [
          { lastGeneratedAt: null },
          {
            generationFrequency: 'DAILY',
            lastGeneratedAt: { lte: generationDueBefore(now, 'DAILY') },
          },
          {
            generationFrequency: 'WEEKLY',
            lastGeneratedAt: { lte: generationDueBefore(now, 'WEEKLY') },
          },
        ],
      },
    })

    // The `where` above drops a client without leaving a trace, so a site that stopped generating
    // looks exactly like a site with nothing due. Name the reason instead of guessing it later.
    const skipped = await skippedSites(
      clients.map((client) => client.id),
      now,
    )

    const BATCH_SIZE = 5

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(processClient))
    }

    return { result: { count: clients.length, skipped, timestamp: now.toISOString() } }
  },
})
