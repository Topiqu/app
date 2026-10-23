import { z } from 'zod'
import { hasAiPlan } from '~~/shared/utils/plans'
import { toDatabaseJson } from '~~/server/utils/databaseJson'
import { WEBSITE_SITE_SELECT } from '~~/server/utils/websiteImport'
import { kickKnowledgeIndex } from '~~/server/utils/knowledge/sources'
import { storeWebsiteAsset } from '~~/server/utils/websiteImport/assets'
import { websiteSnapshot, websiteValueHash } from '~~/server/utils/websiteImport/policy'
import {
  WebsiteResultSchema,
  WebsiteValuesSchema,
  WEBSITE_IMPORT_FIELDS,
  hasWebsiteImportValue,
} from '~~/shared/utils/websiteImport'

const schema = z.object({
  fields: z.array(z.enum(WEBSITE_IMPORT_FIELDS)).max(WEBSITE_IMPORT_FIELDS.length),
  values: WebsiteValuesSchema,
  expected: z.record(z.enum(WEBSITE_IMPORT_FIELDS), z.string().regex(/^[a-f0-9]{64}$/)),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'TENANT_SETTINGS')
  if (!user.clientSiteId) throw createError({ statusCode: 403 })
  const clientSiteId = user.clientSiteId
  await requireAiPlan(clientSiteId, 'Website analysis requires an AI plan')
  const body = await readValidatedBody(event, schema.parse)
  const fields = [...new Set(body.fields)]
  if (fields.includes('socials')) await requireTenantScope(event, 'INTEGRATION_CONTROL')
  if (!(await consumeRateLimit(`website-apply:${user.id}`, 20, 3600))) throw createError({ statusCode: 429 })
  const db = await getEnhancedPrisma(user)
  const id = getRouterParam(event, 'id') ?? ''
  const job = await db.websiteImport.findFirst({
    where: { id, clientSiteId, deletedAt: null },
    select: { id: true, status: true, result: true, acceptedFields: true },
  })
  if (!job) throw createError({ statusCode: 404 })
  if (job.status === 'REVIEWED') return { acceptedFields: job.acceptedFields }
  if (job.status !== 'READY') throw createError({ statusCode: 409, data: { code: 'WEBSITE_NOT_READY' } })
  const parsed = WebsiteResultSchema.safeParse(job.result)
  if (!parsed.success) throw createError({ statusCode: 409, data: { code: 'WEBSITE_NOT_READY' } })
  const assetUrls: Partial<Record<'logoUrl' | 'faviconUrl', string>> = {}
  for (const field of ['logoUrl', 'faviconUrl'] as const) {
    if (!fields.includes(field)) continue
    const sourceUrl = parsed.data.values[field]
    if (!sourceUrl || body.values[field] !== sourceUrl) throw createError({ statusCode: 400 })
    try {
      assetUrls[field] = await storeWebsiteAsset({ id, clientSiteId, field, sourceUrl })
    } catch {
      await reportCaughtError('Website brand asset import failed', new Error('WEBSITE_ASSET_UNAVAILABLE'), {
        importId: id,
        field,
      })
      throw createError({ statusCode: 422, data: { code: 'WEBSITE_ASSET', field } })
    }
  }
  const accepted = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${clientSiteId} AND "deletedAt" IS NULL FOR UPDATE`
    const site = await tx.clientSite.findUniqueOrThrow({
      where: { id: clientSiteId },
      select: { ...WEBSITE_SITE_SELECT, plan: true, deletedAt: true },
    })
    if (site.deletedAt || !hasAiPlan(site.plan)) throw createError({ statusCode: 403 })
    const currentJob = await tx.websiteImport.findFirst({
      where: { id, clientSiteId, deletedAt: null },
      select: { status: true, acceptedFields: true },
    })
    if (currentJob?.status === 'REVIEWED') return currentJob.acceptedFields
    if (currentJob?.status !== 'READY') throw createError({ statusCode: 409 })
    const sources = await tx.knowledgeSource.findMany({
      where: { clientSiteId, websiteImportId: id, deletedAt: null },
      orderBy: { id: 'asc' },
      select: { id: true, version: true, useInArticles: true },
    })
    const current = websiteSnapshot(site)
    const conflicts = fields.filter(
      (field) => body.expected[field] !== websiteValueHash(field === 'knowledge' ? sources : current[field]),
    )
    if (conflicts.length) throw createError({ statusCode: 409, data: { code: 'WEBSITE_CONFLICT', fields: conflicts } })
    if (fields.some((field) => !hasWebsiteImportValue(field, body.values, sources.length)))
      throw createError({ statusCode: 400 })
    const values = body.values
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: {
        ...(fields.includes('accentColor') ? { accentColor: values.accentColor } : {}),
        ...(assetUrls.logoUrl ? { logoUrl: assetUrls.logoUrl } : {}),
        ...(assetUrls.faviconUrl ? { faviconUrl: assetUrls.faviconUrl } : {}),
        ...(fields.includes('keywords')
          ? { keywords: toDatabaseJson([...new Set(values.keywords.map((keyword) => keyword.trim()).filter(Boolean))]) }
          : {}),
        ...(fields.includes('focus') ? { focus: values.focus } : {}),
        ...(fields.includes('audience') ? { audience: values.audience } : {}),
        ...(fields.includes('aiToneOfVoice') ? { aiToneOfVoice: values.aiToneOfVoice } : {}),
        ...(fields.includes('language') && values.language ? { language: values.language } : {}),
      },
    })
    if (fields.includes('socials')) {
      await tx.social.deleteMany({ where: { clientSiteId } })
      for (const social of values.socials)
        await tx.social.create({ data: { clientSiteId, platform: social.platform, url: social.url } })
    }
    if (fields.includes('knowledge'))
      await tx.knowledgeSource.updateMany({
        where: { clientSiteId, websiteImportId: id, deletedAt: null },
        data: { useInArticles: true },
      })
    await tx.websiteImport.update({
      where: { id },
      data: { status: 'REVIEWED', acceptedFields: fields, reviewedAt: new Date(), reviewedById: user.id },
    })
    await logAction({
      action: 'WEBSITE_IMPORT_REVIEWED',
      clientSiteId,
      userId: user.id,
      metadata: {
        importId: id,
        acceptedFields: fields,
        knowledgeSources: fields.includes('knowledge') ? sources.length : 0,
      },
      tx,
    })
    return fields
  })
  if (accepted.includes('knowledge')) {
    const sources = await db.knowledgeSource.findMany({
      where: { clientSiteId, websiteImportId: id, deletedAt: null, useInArticles: true, status: 'PENDING' },
      select: { id: true },
    })
    sources.forEach((source) => kickKnowledgeIndex(source.id))
  }
  await invalidateFeed(clientSiteId)
  return { acceptedFields: accepted }
})
