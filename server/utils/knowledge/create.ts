import type { KnowledgeSource } from '~~/generated/zenstack/models'

import { createError } from 'h3'

type KnowledgeInput = Pick<
  KnowledgeSource,
  'clientSiteId' | 'kind' | 'title' | 'content' | 'contentHash' | 'useInArticles'
> &
  Partial<
    Pick<
      KnowledgeSource,
      | 'createdById'
      | 'websiteImportId'
      | 'publicUrl'
      | 'sourceUrl'
      | 'originalFilename'
      | 'mimeType'
      | 'sizeBytes'
      | 'language'
      | 'currency'
      | 'validAsOf'
      | 'fetchedAt'
    >
  >

export const createKnowledgeSource = (db: DatabaseClient, data: KnowledgeInput, reuseUrl = false) =>
  db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${data.clientSiteId} AND "deletedAt" IS NULL FOR UPDATE`
    const duplicate = await tx.knowledgeSource.findFirst({
      where: {
        clientSiteId: data.clientSiteId,
        deletedAt: null,
        ...(data.kind === 'FEED'
          ? { kind: 'FEED', sourceUrl: data.sourceUrl }
          : {
              OR: [
                { contentHash: data.contentHash },
                ...(reuseUrl && data.sourceUrl ? [{ kind: 'URL' as const, sourceUrl: data.sourceUrl }] : []),
              ],
            }),
      },
      select: KNOWLEDGE_SOURCE_VIEW,
    })
    if (duplicate) return { source: duplicate, reused: true }
    const site = await tx.clientSite.findUniqueOrThrow({ where: { id: data.clientSiteId }, select: { plan: true } })
    const quota = knowledgeQuota(site.plan)
    const [usage] = await tx.$queryRaw<{ sources: number; characters: number }[]>`
    SELECT count(*)::int AS sources, COALESCE(sum(length("content")), 0)::int AS characters
    FROM "KnowledgeSource" WHERE "clientSiteId" = ${data.clientSiteId} AND "deletedAt" IS NULL`
    if (
      (usage?.sources ?? 0) >= quota.maxSources ||
      (usage?.characters ?? 0) + data.content.length > quota.maxCharacters
    )
      throw createError({ statusCode: 409, data: { code: 'KNOWLEDGE_QUOTA' } })
    return { source: await tx.knowledgeSource.create({ data, select: KNOWLEDGE_SOURCE_VIEW }), reused: false }
  })
