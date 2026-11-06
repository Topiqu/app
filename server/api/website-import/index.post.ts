import { z } from 'zod'

const DAY_MS = 86_400_000

const schema = z.object({
  url: z.string().trim().min(1).max(2048),
  consentVersion: z.literal(WEBSITE_IMPORT_CONSENT_VERSION),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'TENANT_SETTINGS')
  if (!user.clientSiteId) throw createError({ statusCode: 403 })
  const clientSiteId = user.clientSiteId
  await requireAiPlan(clientSiteId, 'Website analysis requires an AI plan')
  const body = await readValidatedBody(event, schema.parse)
  const sourceUrl = normalizeWebsiteUrl(body.url)
  if (!sourceUrl) throw createError({ statusCode: 400, data: { code: 'WEBSITE_URL' } })
  if (!(await consumeRateLimit(`website-import-start:${user.id}`, 10, 3600))) throw createError({ statusCode: 429 })

  // The zmodel keeps creation system-only: a create policy would let the generic model API skip consent and caps.
  const job = await prisma
    .$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ClientSite" WHERE "id" = ${clientSiteId} AND "deletedAt" IS NULL FOR UPDATE`
      const site = await tx.clientSite.findFirst({
        where: { id: clientSiteId, deletedAt: null },
        select: { ...WEBSITE_SITE_SELECT, plan: true },
      })
      if (!site || !hasAiPlan(site.plan)) throw createError({ statusCode: 403 })
      const active = await tx.websiteImport.count({
        where: { clientSiteId, deletedAt: null, status: { in: ['PENDING', 'PROCESSING', 'READY'] } },
      })
      if (active) throw createError({ statusCode: 409, data: { code: 'WEBSITE_IMPORT_ACTIVE' } })
      // Deleted rows count too: each import was paid provider work.
      const now = Date.now()
      const today = await tx.websiteImport.count({ where: { clientSiteId, createdAt: { gt: new Date(now - DAY_MS) } } })
      const month = await tx.websiteImport.count({
        where: { clientSiteId, createdAt: { gt: new Date(now - 30 * DAY_MS) } },
      })
      if (today >= WEBSITE_IMPORT_LIMITS.startsPerDay || month >= WEBSITE_IMPORT_LIMITS.startsPerMonth)
        throw createError({ statusCode: 429, data: { code: 'WEBSITE_IMPORT_LIMIT' } })
      const created = await tx.websiteImport.create({
        data: {
          clientSiteId,
          sourceUrl,
          createdById: user.id,
          consentVersion: body.consentVersion,
          baseline: websiteSnapshot(site),
        },
        select: { id: true },
      })
      await logAction({
        action: 'WEBSITE_IMPORT_QUEUED',
        clientSiteId,
        userId: user.id,
        tx,
        metadata: { importId: created.id, consentVersion: body.consentVersion, manual: true },
      })
      return created
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) throw createError({ statusCode: 409, data: { code: 'WEBSITE_IMPORT_ACTIVE' } })
      throw error
    })
  kickWebsiteImport(job.id)
  return { id: job.id }
})
