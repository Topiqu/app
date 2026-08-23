import { markdownPath } from '~~/shared/utils/routes'

/** Tenant index for LLM crawlers: what the blog is, and every article as a markdown link. */
export default defineEventHandler(async (event) => {
  const tenant = await tenantByHost(event)
  if (!tenant) throw createError({ statusCode: 404, message: 'Not found' })

  const origin = requestOrigin(event)

  const articles = await prisma.article.findMany({
    where: { clientSiteId: tenant.id, status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      translations: {
        where: { status: 'PUBLISHED', slug: { not: null } },
        select: { slug: true, title: true, excerpt: true, language: true },
      },
    },
  })

  const entry = (language: string, slug: string, title: string | null, excerpt: string | null) => {
    const url = `${origin}${markdownPath(language as never, slug)}`
    return excerpt ? `- [${title}](${url}): ${excerpt.replace(/\s+/g, ' ').trim()}` : `- [${title}](${url})`
  }

  const lines = [
    `# ${tenant.name}`,
    '',
    ...(tenant.description ? [`> ${tenant.description}`, ''] : []),
    ...(tenant.focus ? [`Topics: ${tenant.focus}`] : []),
    ...(tenant.audience ? [`Audience: ${tenant.audience}`] : []),
    `Primary language: ${tenant.language}`,
    '',
    '## Articles',
    '',
    ...articles.flatMap((article) => [
      entry(tenant.language, article.slug, article.title, article.excerpt),
      ...article.translations.map((tr) => entry(tr.language, tr.slug!, tr.title, tr.excerpt)),
    ]),
    '',
    '## Optional',
    '',
    `- [Sitemap](${origin}/sitemap.xml)`,
    `- [Feed](${origin}/rss.xml)`,
    '',
  ]

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=600, s-maxage=600')
  return lines.join('\n')
})
