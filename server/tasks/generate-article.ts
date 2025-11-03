import type { EventStream } from 'h3'
import slugify from 'slugify'

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
    Create a detailed blog article on a trending topic relevant to my audience.

    Target audience: ${client.audience || 'general'}
    Focus area: ${client.focus || 'general topics'}
    Keywords to include naturally: ${client.keywords?.join(', ') ?? 'none'}

    CRITICAL LANGUAGE RULE:
    - Default language is ${defaultLang.toUpperCase()}.
    - BUT: If ANY of the input (keywords, audience, focus) contains text in a DIFFERENT language (e.g. Turkish, Thai, Arabic, etc.),
      THEN: OVERRIDE the default and write the ENTIRE article in THAT language.
    - Translate all other parts (title, content, perex) into that detected language.
    - Use proper grammar, formatting, and cultural context of the detected language.

    Respond ONLY in valid JSON as defined in the schema.
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

  await prisma.clientSite.update({
    where: { id: clientSiteId },
    data: {
      tokenRemaining: { decrement: tokens },
      totalUsage: { increment: tokens },
      lastGeneratedAt: new Date(),
    },
  })

  await logAction({
    action: 'CRON_GENERATE_ARTICLE',
    clientSiteId,
    metadata: { ...generated, usage },
  })

  const status = client.autoRelease ? 'published' : 'draft'

  const article = await prisma.$transaction(async (ctx: any) => {
    const slug = await generateUniqueSlug(ctx, generated.title, clientSiteId)

    const article = await ctx.article.create({
      select: { id: true, title: true, userId: true, user: { select: { username: true } } },
      data: {
        title: generated.title,
        excerpt: generated.perex,
        slug,
        userId: client.users[0]?.id || 'system',
        content: generated.content,
        clientSiteId,
        status,
      },
    })

    await ctx.articleTag.createMany({
      data: generated.tags.map((tagId: string) => ({ articleId: article.id, tagId })),
      skipDuplicates: true,
    })

    return article
  })

  if (status === 'published') {
    await logAction({
      action: 'CRON_ARTICLE_PUBLISHED',
      userId: article.userId,
      clientSiteId,
      metadata: { articleId: article.id, title: article.title, autoReleased: client.autoRelease },
    })

    const sendNotifications = async () => {
      const notification = await prisma.notification.create({
        data: {
          message: `Tvůj naplánovaný článek "${article.title}" byl publikován`,
          userId: article.userId,
          articleId: article.id,
          type: 'ARTICLE_PUBLISHED',
        },
      })

      const streamKey = `notifications:${notification.userId}`
      const streams = globalThis.eventStreams?.get(streamKey)
      if (streams) {
        const serialized = JSON.stringify({ ...notification, count: 1 })
        streams.forEach((stream) => stream.push(serialized))
      }

      const followers = await prisma.follow.findMany({
        where: { followedId: article.userId, follower: { allowNotifs: true } },
        select: { followerId: true },
      })

      const BATCH_SIZE = 100
      const notifications = followers.map((f) => ({
        message: `${article.user?.username ?? 'Autor'} vydal nový článek: ${article.title}`,
        userId: f.followerId,
        articleId: article.id,
        type: 'ARTICLE_PUBLISHED' as const,
      }))

      for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
        const batch = notifications.slice(i, i + BATCH_SIZE)
        await prisma.notification.createMany({ data: batch, skipDuplicates: true })
        batch.forEach((n) => {
          const key = `notifications:${n.userId}`
          const s = globalThis.eventStreams?.get(key)
          if (s) s.forEach((stream) => stream.push(JSON.stringify({ ...n, count: 1 })))
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

export default defineTask({
  meta: {
    name: 'generate-article',
    description: 'Generates articles using AI',
  },
  async run() {
    const now = Date.now()

    const clients = await prisma.clientSite.findMany({
      select: {
        id: true,
        autoRelease: true,
        audience: true,
        keywords: true,
        focus: true,
        language: true,
        generationFrequency: true,
        lastGeneratedAt: true,
        users: { select: { id: true }, orderBy: { role: 'asc' }, take: 1 },
      },
      where: {
        tokenRemaining: { gt: 7000 },
        generationFrequency: { in: ['DAILY', 'WEEKLY'] },
        OR: [
          { lastGeneratedAt: null },
          {
            generationFrequency: 'DAILY',
            lastGeneratedAt: { lt: new Date(now - 24 * 60 * 60 * 1000) },
          },
          {
            generationFrequency: 'WEEKLY',
            lastGeneratedAt: { lt: new Date(now - 7 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    })

    const BATCH_SIZE = 5

    for (let i = 0; i < clients.length; i += BATCH_SIZE) {
      const batch = clients.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(processClient))
    }

    return { result: { count: clients.length, timestamp: new Date(now).toISOString() } }
  },
})
