import type { Language } from '@prisma/client'

import { readFaq } from '~~/shared/utils/articleFaq'
import { LOCALIZED_SEGMENTS } from '~~/shared/utils/routes'

/** `/md/{locale}/{segment}/{slug}[.md]` — the plain-text article for LLM and agent consumption. */
export default defineEventHandler(async (event) => {
  const tenant = await tenantByHost(event)
  if (!tenant) throw createError({ statusCode: 404, message: 'Not found' })

  const parts = (getRouterParam(event, 'path') ?? '').replace(/\.md$/, '').split('/').filter(Boolean)
  if (parts.length !== 3) throw createError({ statusCode: 404, message: 'Not found' })

  const [language, segment, rawSlug] = parts as [Language, string, string]
  if (LOCALIZED_SEGMENTS.article[language] !== segment) throw createError({ statusCode: 404, message: 'Not found' })

  const slug = decodeURIComponent(rawSlug)

  const article = await resolveArticleBySlug<{
    title: string
    excerpt: string | null
    content: string
    publishedAt: Date | null
    createdAt: Date
    updatedAt: Date | null
    sources: string[]
    answer: string | null
    keyTakeaways: string[]
    faq: unknown
    user: { username: string | null } | null
    tags: { tag: { name: string } }[]
  }>(
    prisma,
    { slug, clientSiteId: tenant.id, locale: language, primaryLanguage: tenant.language },
    {
      title: true,
      excerpt: true,
      content: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      sources: true,
      answer: true,
      keyTakeaways: true,
      faq: true,
      user: { select: { username: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  )

  if (!article || (article as { status?: string }).status !== 'published') {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const tags = article.tags.map((entry) => entry.tag.name)
  const faq = readFaq(article.faq)
  const published = article.publishedAt ?? article.createdAt

  const document = [
    `# ${article.title}`,
    '',
    ...(article.excerpt ? [`> ${article.excerpt}`, ''] : []),
    `Source: ${requestOrigin(event)}${event.path.replace(/^\/md/, '').replace(/\.md$/, '')}`,
    `Published: ${published.toISOString().slice(0, 10)}`,
    ...(article.updatedAt ? [`Updated: ${article.updatedAt.toISOString().slice(0, 10)}`] : []),
    ...(article.user?.username ? [`Author: ${article.user.username}`] : []),
    ...(tags.length ? [`Tags: ${tags.join(', ')}`] : []),
    '',
    '---',
    '',
    ...(article.answer ? [article.answer, ''] : []),
    ...(article.keyTakeaways.length
      ? ['## Key takeaways', '', ...article.keyTakeaways.map((item) => `- ${item}`), '']
      : []),
    contentToMarkdown(article.content),
    ...(faq.length ? ['', '## FAQ', '', ...faq.flatMap((entry) => [`### ${entry.question}`, '', entry.answer, ''])] : []),
    ...(article.sources.length ? ['', '## Sources', '', ...article.sources.map((url) => `- ${url}`)] : []),
    '',
  ]

  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=600, s-maxage=600')
  return document.join('\n')
})
