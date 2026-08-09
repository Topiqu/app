import type { Language } from '@prisma/client'

/** Explicit because the row also carries `prompt` and the tenant's savings figures. */
const PUBLIC_FIELDS = {
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  userId: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  imageUrl: true,
  imageCredit: true,
  status: true,
  clientSiteId: true,
  views: true,
  shared: true,
  aiInvolvement: true,
  readingTime: true,
  totalWords: true,
  articleSeriesId: true,
  seriesOrder: true,
  releaseAt: true,
  allowedComments: true,
  sources: true,
  answer: true,
  keyTakeaways: true,
  faq: true,
} as const

/** The editor loads through this same route, so an admin still needs the internals. */
const ADMIN_FIELDS = { prompt: true, savedAmount: true, savedTimeMinutes: true } as const

/** `reactions` is scoped to the caller: unfiltered it shipped every liker's id to answer one bool. */
const articleSelect = (isAdmin: boolean, viewer: { userId?: string; sessionId?: string }) => ({
  ...PUBLIC_FIELDS,
  ...(isAdmin ? ADMIN_FIELDS : {}),
  user: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true,
      _count: { select: { following: true } },
    },
  },
  tags: { include: { tag: true } },
  articleSeries: { select: { id: true, name: true, slug: true } },
  reactions: {
    where: viewer.userId ? { userId: viewer.userId } : viewer.sessionId ? { sessionId: viewer.sessionId } : { id: '' },
    select: { id: true },
    take: 1,
  },
  _count: {
    select: {
      comments: { where: { deletedAt: null } },
      reactions: true,
    },
  },
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const sessionId = getCookie(event, 'anon_session')
  const { clientSiteId, locale } = getQuery<{ clientSiteId: string; locale?: Language }>(event)
  if (!clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { language: true },
  })
  const primaryLanguage = clientSite?.language ?? 'en'
  const isAdmin = user?.role === 'admin'
  const select = articleSelect(isAdmin, { userId: user?.id, sessionId })

  // Locale-scoped resolution: the primary language renders the source Article; any other
  // locale renders its ArticleTranslation. Because each locale looks in exactly one place,
  // a translated slug can never collide with a different article's source slug.
  const wantsTranslation = !!locale && locale !== primaryLanguage

  let article: any
  let language: Language = primaryLanguage
  let translationStatus: string | null = null
  let baseSlug = slug
  let resolvedAsTranslation = false

  if (wantsTranslation) {
    const translation = await prisma.articleTranslation.findUnique({
      where: { slug_clientSiteId_language: { slug, clientSiteId, language: locale } },
      select: {
        status: true,
        title: true,
        excerpt: true,
        content: true,
        slug: true,
        answer: true,
        keyTakeaways: true,
        faq: true,
        article: { select },
      },
    })
    const visible =
      translation?.article &&
      (translation.status === 'PUBLISHED' || isAdmin) &&
      (translation.article.status === 'published' || isAdmin)

    if (visible) {
      baseSlug = translation!.article.slug
      // Render the translated body over the canonical article's shared data (author, dates,
      // series, engagement). Slug becomes the localized one for self-canonical / routing.
      article = {
        ...translation!.article,
        title: translation!.title,
        excerpt: translation!.excerpt,
        content: translation!.content,
        slug: translation!.slug,
        // Fall back to the source: a row translated before these columns existed has them null,
        // and showing the source language beats showing nothing.
        answer: translation!.answer ?? translation!.article.answer,
        keyTakeaways: translation!.keyTakeaways?.length
          ? translation!.keyTakeaways
          : translation!.article.keyTakeaways,
        faq: translation!.faq ?? translation!.article.faq,
      }
      language = locale!
      translationStatus = translation!.status
      resolvedAsTranslation = true
    }
  }

  if (!resolvedAsTranslation) {
    // Source content — and the fallback for a not-yet-translated locale (legacy i18n alias):
    // the body stays in the primary language and SEO collapses to the primary-language URL.
    article = await prisma.article.findUnique({
      where: { slug_clientSiteId: { slug, clientSiteId } },
      select,
    })
    if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
    if (article.status !== 'published' && !isAdmin)
      throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
    baseSlug = article.slug
    language = primaryLanguage
  }

  // hreflang alternates: the source (primary language) plus every PUBLISHED translation.
  const publishedTranslations = await prisma.articleTranslation.findMany({
    where: { articleId: article.id, status: 'PUBLISHED', slug: { not: null } },
    select: { language: true, slug: true },
  })
  const alternates = [
    { language: primaryLanguage, slug: baseSlug },
    ...publishedTranslations.map((tr) => ({ language: tr.language, slug: tr.slug! })),
  ]

  let seriesNav = null

  if (article.articleSeriesId && article.seriesOrder !== null) {
    const whereFilter: any = { articleSeriesId: article.articleSeriesId }
    if (!isAdmin) whereFilter.status = 'published'

    const allSeriesArticles = await prisma.article.findMany({
      where: whereFilter,
      orderBy: { seriesOrder: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        seriesOrder: true,
        status: true,
      },
    })

    const currentIndex = allSeriesArticles.findIndex((a) => a.id === article.id)
    const prev = currentIndex > 0 ? allSeriesArticles[currentIndex - 1] : null
    const next =
      currentIndex !== -1 && currentIndex < allSeriesArticles.length - 1 ? allSeriesArticles[currentIndex + 1] : null

    seriesNav = {
      name: article.articleSeries?.name,
      slug: article.articleSeries?.slug,
      total: allSeriesArticles.length,
      current: article.seriesOrder,
      prev,
      next,
      articles: allSeriesArticles,
    }
  }

  const { reactions, _count, ...rest } = article

  return {
    ...rest,
    language,
    translationStatus,
    alternates,
    // Only place that sees the resolved translation, so the split belongs here.
    ...articleBlocks(article.content),
    commentCount: _count.comments,
    likes: _count.reactions,
    likedByUser: reactions.length > 0,
    followerCount: article.user?._count.following ?? 0,
    series: seriesNav,
  }
})
