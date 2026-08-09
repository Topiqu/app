import { articlePath } from '~~/shared/utils/routes'

const xml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

export default defineEventHandler(async (event) => {
  const tenant = await tenantByHost(event)
  if (!tenant) throw createError({ statusCode: 404, message: 'Not found' })

  const origin = requestOrigin(event)

  const articles = await prisma.article.findMany({
    where: { clientSiteId: tenant.id, status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      createdAt: true,
      user: { select: { username: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  })

  const items = articles.map((article) => {
    const url = `${origin}${articlePath(tenant.language, article.slug)}`
    return [
      '    <item>',
      `      <title>${xml(article.title)}</title>`,
      `      <link>${xml(url)}</link>`,
      `      <guid isPermaLink="true">${xml(url)}</guid>`,
      `      <pubDate>${(article.publishedAt ?? article.createdAt).toUTCString()}</pubDate>`,
      ...(article.excerpt ? [`      <description>${xml(article.excerpt)}</description>`] : []),
      ...(article.user?.username ? [`      <dc:creator>${xml(article.user.username)}</dc:creator>`] : []),
      ...article.tags.map((entry) => `      <category>${xml(entry.tag.name)}</category>`),
      '    </item>',
    ].join('\n')
  })

  const feed = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '  <channel>',
    `    <title>${xml(tenant.name)}</title>`,
    `    <link>${xml(origin)}</link>`,
    `    <description>${xml(tenant.description ?? tenant.name)}</description>`,
    `    <language>${tenant.language}</language>`,
    `    <atom:link href="${xml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ]

  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=600, s-maxage=600')
  return feed.join('\n')
})
