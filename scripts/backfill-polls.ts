import * as cheerio from 'cheerio'
import { parseArgs } from 'node:util'

import type { DatabaseClient } from '../server/utils/database'

import { syncArticlePolls } from '../server/utils/articlePolls'
import { createDatabaseClient } from '../server/utils/database'
import { closeCache, invalidateFeed } from '../server/utils/cache'

export const backfillPolls = async (
  prisma: DatabaseClient,
  options: { apply?: boolean; limit?: number; batchSize?: number; afterId?: string; clientSiteId?: string } = {},
) => {
  const limit = options.limit ?? 1000
  const batchSize = options.batchSize ?? 100
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100_000)
    throw new Error('limit must be an integer from 1 to 100000')
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 200)
    throw new Error('batch-size must be an integer from 1 to 200')
  if (options.afterId !== undefined && (!options.afterId || options.afterId.length > 128))
    throw new Error('Invalid resume cursor')
  if (options.clientSiteId !== undefined && (!options.clientSiteId || options.clientSiteId.length > 128))
    throw new Error('Invalid tenant filter')
  let cursor = options.afterId
  let scanned = 0
  let needed = 0
  let updated = 0
  let conflicted = 0
  let cacheInvalidated = 0
  let cacheUnavailable = 0
  let cacheUnconfigured = 0

  while (scanned < limit) {
    const take = Math.min(batchSize, limit - scanned)
    const articles = await prisma.article.findMany({
      where: {
        deletedAt: null,
        ...(options.clientSiteId ? { clientSiteId: options.clientSiteId } : {}),
        OR: [{ content: { contains: 'data-type="poll"' } }, { content: { contains: "data-type='poll'" } }],
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, clientSiteId: true, content: true },
      orderBy: { id: 'asc' },
      take,
    })
    if (!articles.length) break
    for (const article of articles) {
      scanned++
      cursor = article.id
      const $ = cheerio.load(article.content, null, false)
      if (
        !$('div[data-type="poll"]')
          .toArray()
          .some((element) => !$(element).attr('data-poll-id'))
      )
        continue
      needed++
      if (!options.apply) continue
      const result = await prisma.$transaction(async (tx) => {
        // Lock and compare before creating poll rows; a newer author edit wins untouched.
        const current = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Article"
          WHERE "id" = ${article.id} AND "clientSiteId" = ${article.clientSiteId}
            AND "deletedAt" IS NULL AND "content" = ${article.content}
          FOR UPDATE
        `
        if (!current.length) return 'conflict'
        const content = await syncArticlePolls(tx, article.id, article.content)
        if (content === article.content) return 'unchanged'
        await tx.article.update({ where: { id: article.id }, data: { content } })
        return 'updated'
      })
      if (result === 'updated') {
        updated++
        // Invalidate after commit, including when a later row stops the run.
        let cache: Awaited<ReturnType<typeof invalidateFeed>>
        try {
          cache = await invalidateFeed(article.clientSiteId)
        } catch {
          cache = 'unavailable'
        }
        if (cache === 'invalidated') cacheInvalidated++
        else {
          if (cache === 'unconfigured') cacheUnconfigured++
          else cacheUnavailable++
          console.warn('[poll-backfill] committed repair needs cache invalidation', {
            clientSiteId: article.clientSiteId,
            cache,
          })
        }
      }
      if (result === 'conflict') conflicted++
    }
    if (articles.length < take) break
  }

  return {
    scanned,
    needed,
    updated,
    conflicted,
    cacheInvalidated,
    cacheUnavailable,
    cacheUnconfigured,
    nextCursor: scanned === limit ? (cursor ?? null) : null,
  }
}

if (import.meta.main) {
  const prisma = createDatabaseClient()
  try {
    const { values } = parseArgs({
      options: {
        limit: { type: 'string' },
        'batch-size': { type: 'string' },
        after: { type: 'string' },
        site: { type: 'string' },
      },
    })
    const apply = process.env.APPLY === '1'
    const result = await backfillPolls(prisma, {
      apply,
      limit: Number(values.limit ?? 1000),
      batchSize: Number(values['batch-size'] ?? 100),
      afterId: values.after,
      clientSiteId: values.site,
    })
    console.info(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', clientSiteId: values.site ?? null, ...result }))
  } finally {
    try {
      await closeCache()
    } finally {
      await prisma.$disconnect()
    }
  }
}
