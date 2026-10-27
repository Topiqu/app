import type { Language } from '~~/generated/zenstack/models'

/** Explicit because the row also carries `prompt` and the tenant's savings figures. */
const PUBLIC_FIELDS = {
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  contentUpdatedAt: true,
  userId: true,
  slug: true,
  language: true,
  title: true,
  excerpt: true,
  content: true,
  imageUrl: true,
  imageCredit: true,
  coverMediaId: true,
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
const ADMIN_FIELDS = { editVersion: true, prompt: true, savedAmount: true, savedTimeMinutes: true } as const

/** `reactions` is scoped to the caller: unfiltered it shipped every liker's id to answer one bool. */
const articleSelect = (isAdmin: boolean, viewer: { userId?: string; sessionId?: string | null }) => ({
  ...PUBLIC_FIELDS,
  deletedAt: true,
  clientSite: { select: { commentsEnabled: true, commentGifsEnabled: true, domain: true, deletedAt: true } },
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
  const user = await getSessionUser(event)
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const sessionId = readAnonSession(event)
  const { clientSiteId: requestedClientSiteId, locale } = getQuery<{ clientSiteId?: string; locale?: Language }>(event)
  const clientSiteId = requestedClientSiteId || sessionTenantId(user)
  if (!clientSiteId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const isAdmin = hasArticleAdminAccess(user, clientSiteId)

  const select = articleSelect(isAdmin, { userId: user?.id, sessionId })

  let article: any
  let language: Language = 'en'
  let primaryLanguage: Language = 'en'
  let translationStatus: string | null = null
  let baseSlug = slug
  let resolvedAsTranslation = false

  // Source slugs win in their own language; a translation may share its slug with a source
  // article in another language. An admin id lookup still resolves the source directly.
  const sourceAtLocale = locale
    ? await prisma.article.findFirst({
        where: { clientSiteId, language: locale, OR: isAdmin ? [{ slug }, { id: slug }] : [{ slug }] },
        select,
      })
    : null

  if (locale && !sourceAtLocale) {
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
      translation.status === 'PUBLISHED' &&
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
        keyTakeaways: translation!.keyTakeaways?.length ? translation!.keyTakeaways : translation!.article.keyTakeaways,
        faq: translation!.faq ?? translation!.article.faq,
      }
      language = locale!
      primaryLanguage = translation!.article.language
      translationStatus = translation!.status
      resolvedAsTranslation = true
    }
  }

  if (!resolvedAsTranslation) {
    // Source content — and the fallback for a not-yet-translated locale (legacy i18n alias):
    // the body stays in the primary language and SEO collapses to the primary-language URL.
    article =
      sourceAtLocale ??
      (isAdmin
        ? await prisma.article.findFirst({
            where: { clientSiteId, OR: [{ slug }, { id: slug }] },
            select,
          })
        : await prisma.article.findUnique({
            where: { slug_clientSiteId: { slug, clientSiteId } },
            select,
          }))
    // 404, not 403: a distinct status would confirm that an unpublished slug exists.
    if (!article || !canReadArticle(user, article)) {
      const redirect = article
        ? null
        : await prisma.articleSlugRedirect.findUnique({
            where: { slug_clientSiteId: { slug, clientSiteId } },
            select: {
              article: {
                select: {
                  slug: true,
                  status: true,
                  clientSiteId: true,
                  deletedAt: true,
                  releaseAt: true,
                  clientSite: { select: { deletedAt: true } },
                },
              },
            },
          })
      const movedTo =
        redirect && redirect.article.clientSiteId === clientSiteId && canReadArticle(user, redirect.article)
          ? redirect.article.slug
          : null
      // The page turns `movedTo` into a 301; an old link must keep working after a slug change.
      throw createError({
        statusCode: 404,
        message: t('common.errors.articleNotFound')!,
        ...(movedTo ? { data: { movedTo } } : {}),
      })
    }
    baseSlug = article.slug
    primaryLanguage = article.language
    language = primaryLanguage
  }

  if (!canReadArticle(user, article))
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

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
    const allSeriesArticles = await prisma.article.findMany({
      where: {
        articleSeriesId: article.articleSeriesId,
        clientSiteId,
        deletedAt: null,
        status: 'published',
        OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
      },
      orderBy: [{ seriesOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        excerpt: true,
        slug: true,
        language: true,
        imageUrl: true,
        seriesOrder: true,
        status: true,
      },
    })

    const navigation = seriesNavigation(allSeriesArticles, article.id)
    seriesNav = navigation
      ? {
          name: article.articleSeries?.name,
          slug: article.articleSeries?.slug,
          ...navigation,
        }
      : null
  }

  const { reactions, _count, clientSite, deletedAt: _deletedAt, ...rest } = article

  return {
    ...rest,
    commentingEnabled: article.allowedComments && clientSite.commentsEnabled,
    commentGifsEnabled: clientSite.commentGifsEnabled,
    // Likes, feedback and poll votes open with publication; the page shows them closed until then.
    engagementOpen: isArticleLive(article),
    sourceSlug: baseSlug,
    language,
    primaryLanguage,
    translationStatus,
    alternates,
    // Only place that sees the resolved translation, so the split belongs here.
    // `content` stays as stored for the editor; only the rendered blocks carry resolved links.
    ...articleBlocks(
      await resolveArticleLinks(prisma, article.content, {
        clientSiteId: article.clientSiteId,
        language,
        tenantDomain: clientSite.domain,
      }),
      { adBreak: true },
    ),
    commentCount: _count.comments,
    likes: _count.reactions,
    likedByUser: reactions.length > 0,
    followerCount: article.user?._count.following ?? 0,
    series: seriesNav,
  }
})
