import type { WebsiteImportResponse, WebsiteImportField } from '~~/shared/utils/websiteImport'

import { WebsiteResultSchema, WEBSITE_IMPORT_FIELDS } from '~~/shared/utils/websiteImport'

import type { DatabaseClient } from '../database'

import { WEBSITE_SITE_SELECT } from './index'
import { websiteSnapshot, websiteValueHash } from './policy'

export const websiteImportView = async (clientSiteId: string, db: DatabaseClient): Promise<WebsiteImportResponse> => {
  const site = await db.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { ...WEBSITE_SITE_SELECT, websiteUrl: true },
  })
  const job = await db.websiteImport.findFirst({
    where: { clientSiteId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      sourceUrl: true,
      result: true,
      acceptedFields: true,
      errorCode: true,
      knowledgeSources: {
        where: { clientSiteId, deletedAt: null },
        select: { id: true, title: true, sourceUrl: true, status: true, version: true, useInArticles: true },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!job) return { websiteUrl: site.websiteUrl, import: null }
  const current = websiteSnapshot(site)
  const parsed = WebsiteResultSchema.safeParse(job.result)
  const expected = Object.fromEntries(
    WEBSITE_IMPORT_FIELDS.map((field) => [
      field,
      websiteValueHash(
        field === 'knowledge'
          ? job.knowledgeSources.map(({ id, version, useInArticles }) => ({ id, version, useInArticles }))
          : current[field],
      ),
    ]),
  )
  return {
    websiteUrl: site.websiteUrl,
    import: {
      id: job.id,
      sourceUrl: job.sourceUrl,
      status: job.status,
      result: parsed.success ? parsed.data : null,
      current,
      expected,
      knowledge: job.knowledgeSources.map(({ id, title, sourceUrl, status }) => ({ id, title, sourceUrl, status })),
      acceptedFields: job.acceptedFields.filter((field): field is WebsiteImportField =>
        WEBSITE_IMPORT_FIELDS.some((value) => value === field),
      ),
      errorCode: job.errorCode,
    },
  }
}
