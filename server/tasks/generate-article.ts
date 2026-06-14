import type { EventStream } from 'h3'

import slugify from 'slugify'
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

const processClient = async (client: any) => {
  const clientSiteId = client.id
  const defaultLang = client.language

  const prompt = `
  Generate a blog article for the client.

  Audience: ${client.audience || 'general'}
  Focus: ${client.focus || 'general topics'}
  Keywords: ${client.keywords?.join(', ') ?? 'none'}

  ## TOPIC RULES
  - Do NOT create an article that is semantically similar to previous ones.
  - Similarity = same topic, argument, or thesis, not wording.
  - Past article summaries (avoid these topics):
  ${client.articles.map((a: any) => `- ${a.excerpt}`).join('\n') || 'none'}

  Before writing, choose a topic and confirm it is:
  1) Meaningfully different
  2) Not rephrased
  3) Adds a new angle or unanswered question
  
  ## COMMUNITY INSIGHT (optional)
  ${client.communityInsight?.suggestion || 'none'}
  If relevant AND non-duplicate, prefer it as topic.

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
    ;({ usage, ...generated } = await generateArticle(clientSiteId, prompt))
  } catch (err) {
    await logAction({
      action: 'CRON_GENERATE_ARTICLE_FAILED',
      clientSiteId,
      metadata: { error: (err as any).message },
    })
    return
  }

  const tokens = usage.totalTokens ?? 0
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

  const metrics = calculateArticleMetrics(generated.content, client.humanHourlyRate, client.humanWordsPerHour)

  await logAction({
    action: 'CRON_GENERATE_ARTICLE',
    clientSiteId,
    metadata: { ...generated, usage, metrics },
  })

  const status = client.autoRelease ? 'published' : 'draft'

  const article = await prisma.$transaction(async (ctx: any) => {
    const slug = await generateUniqueSlug(ctx, generated.title, clientSiteId)

    const article = await ctx.article.create({
      select: { id: true, title: true, userId: true, user: { select: { username: true, language: true, role: true } } },
      data: {
        title: generated.title,
        excerpt: generated.perex,
        slug,
        userId: client.users[0]?.id || 'system',
        content: generated.content,
        clientSiteId,
        status,
        aiInvolvement: 'FULL',
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

  await prisma.clientSite.update({
    where: { id: clientSiteId },
    data: { lastGeneratedAt: new Date() },
  })

  if (status === 'published') {
    await syncArticleTranslationQueue(prisma, article.id, clientSiteId)

    await logAction({
      action: 'CRON_ARTICLE_PUBLISHED',
      userId: article.userId,
      clientSiteId,
      metadata: { articleId: article.id, title: article.title, autoReleased: client.autoRelease },
    })

    const sendNotifications = async () => {
      if (article.user?.role !== 'ai') {
        const { translate } = await useServerI18n(event as any, { locale: article.user?.language || 'cs' })
        const authorMessage = translate('notifications.articlePublished', [article.title])

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
          const { translate } = await useServerI18n(event as any, { locale: lang })
          const message = translate('notifications.newArticleFromFollowed', [username, article.title])!
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
    const now = Date.now()

    const clients = await prisma.clientSite.findMany({
      select: {
        id: true,
        humanHourlyRate: true,
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
        tokenRemaining: { gt: 7000 },
        generationFrequency: { in: ['DAILY', 'WEEKLY'] },
        OR: [
          { lastGeneratedAt: null },
          {
            generationFrequency: 'DAILY',
            lastGeneratedAt: { lte: new Date(now - 24 * 60 * 60 * 1000) },
          },
          {
            generationFrequency: 'WEEKLY',
            lastGeneratedAt: { lte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    })

    const BATCH_SIZE = 5

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(processClient))
    }

    return { result: { count: clients.length, timestamp: new Date(now).toISOString() } }
  },
})
