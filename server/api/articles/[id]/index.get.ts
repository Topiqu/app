import type { Language } from '@prisma/client'

const articleInclude = {
  user: {
    select: {
      username: true,
      id: true,
      email: true,
      avatarUrl: true,
      _count: { select: { following: true } },
    },
  },
  tags: { include: { tag: true } },
  reactions: true,
  articleSeries: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  _count: {
    select: {
      comments: { where: { deletedAt: null } },
      reactions: true,
    },
  },
} as const

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const sessionId = getCookie(event, 'anon_session')
  const { clientSiteId, locale } = getQuery<{ clientSiteId: string; locale?: Language }>(event)

  const clientSite = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { language: true },
  })
  const primaryLanguage = clientSite?.language ?? 'en'
  const isAdmin = user?.role === 'admin'

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
      include: { article: { include: articleInclude } },
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
      include: articleInclude,
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

  return {
    ...article,
    language,
    translationStatus,
    alternates,
    commentCount: article._count.comments,
    likes: article._count.reactions,
    likedByUser: user?.id
      ? article.reactions.some((r: any) => r.userId === user.id)
      : sessionId
        ? article.reactions.some((r: any) => r.sessionId === sessionId)
        : false,
    followerCount: article.user?._count.following ?? 0,
    series: seriesNav,
  }
})
