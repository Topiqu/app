// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionUser } from '../../shared/types/auth'

import { stubNitroImports } from '../helpers/nitroImports'
import { emptyWebsiteValues, normalizeWebsiteUrl } from '../../shared/utils/websiteImport'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/knowledge/indexing'), 'indexKnowledgeSource')
  await stubNitroImports(import('../../server/utils/storage'), 'putToCdn')
  await stubNitroImports(
    import('../../server/utils/websiteImport/policy'),
    'websiteSnapshot',
    'websiteValueHash',
    'WEBSITE_IMPORT_LIMITS',
  )
  await stubNitroImports(import('../../server/utils/imageAnalysis'), 'analyzeImage')
  await stubNitroImports(
    import('../../server/utils/images/publicFetch'),
    'assertPublicHttpsUrl',
    'fetchPublicUrl',
    'readLimitedBody',
  )
  await stubNitroImports(import('../../server/utils/websiteImport/assets'), 'readWebsiteAsset', 'storeWebsiteAsset')
  await stubNitroImports(import('../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(
    import('../../server/utils/knowledge/sources'),
    'hashKnowledge',
    'KNOWLEDGE_SOURCE_VIEW',
    'kickKnowledgeIndex',
  )
  await stubNitroImports(import('../../server/utils/brandPalette'), 'suggestBrandColors')
  await stubNitroImports(import('../../server/utils/knowledge/extract'), 'extractKnowledgeUrl')
  await stubNitroImports(import('../../server/utils/knowledge/create'), 'createKnowledgeSource')
  await stubNitroImports(
    import('../../server/utils/websiteImport/metadata'),
    'emptyWebsiteMetadata',
    'extractWebsiteMetadata',
  )
  await stubNitroImports(import('../../server/utils/websiteImport/index'), 'WEBSITE_SITE_SELECT')
}

await stubImports()

const { createDatabaseClient } = await import('../../server/utils/database')
const { websiteImportView } = await import('../../server/utils/websiteImport/view')
const { websiteValueHash } = await import('../../server/utils/websiteImport/policy')
const { createKnowledgeSource } = await import('../../server/utils/knowledge/create')
const { drainWebsiteImports, processWebsiteImport } = await import('../../server/utils/websiteImport')

// The production creation boundary is the signed onboarding checkout, covered separately.
const queueWebsiteImport = async (
  clientSiteId: string,
  input: string,
  createdById: string,
  client: NonNullable<typeof db>,
) =>
  client.websiteImport.create({
    data: {
      clientSiteId,
      sourceUrl: normalizeWebsiteUrl(input)!,
      createdById,
      consentVersion: 1,
      baseline: emptyWebsiteValues(),
    },
  })

const mocks = vi.hoisted(() => ({
  research: vi.fn(),
  analyze: vi.fn(),
  extract: vi.fn(),
  audit: vi.fn(),
  report: vi.fn(),
  index: vi.fn(),
  budget: '100',
}))
vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: () => ({ anthropic: { apiKey: 'synthetic-key' }, websiteImport: { dailyBudgetUsd: mocks.budget } }),
}))
mockNuxtImport('useRuntimeConfig', () => () => ({
  anthropic: { apiKey: 'synthetic-key' },
  websiteImport: { dailyBudgetUsd: mocks.budget },
}))
vi.mock('../../server/utils/websiteImport/ai', () => ({
  researchWebsite: mocks.research,
  analyzeWebsite: mocks.analyze,
}))
vi.mock('../../server/utils/knowledge/extract', async (original) => ({
  ...(await original<typeof import('../../server/utils/knowledge/extract')>()),
  extractKnowledgeUrl: mocks.extract,
}))
vi.mock('../../server/utils/images/publicFetch', async (original) => ({
  ...(await original<typeof import('../../server/utils/images/publicFetch')>()),
  assertPublicHttpsUrl: async (value: string) => new URL(value),
}))
vi.mock('../../server/utils/log', () => ({ logAction: mocks.audit }))
vi.mock('../../server/utils/knowledge/indexing', () => ({ indexKnowledgeSource: mocks.index }))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const user: SessionUser = {
  id: randomUUID(),
  name: 'Synthetic owner',
  email: 'owner@example.org',
  role: 'admin',
  clientSiteId: '',
  plan: 'PREMIUM',
  scopes: ['TENANT_SETTINGS', 'INTEGRATION_CONTROL'],
  avatarUrl: null,
  sessionId: randomUUID(),
}
const usage = {
  inputTokens: 100,
  outputTokens: 50,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  searches: 1,
  estimatedCostMicros: 10_035,
  durationMs: 10,
}
let apply: typeof import('../../server/api/website-import/[id]/apply.post').default
const tenant = async () => {
  const id = randomUUID()
  return db!.clientSite.create({
    data: { id, name: `website-${id}`, domain: `${id}.example.org`, plan: 'PREMIUM', language: 'cs' },
  })
}
const run = async () => {
  const site = await tenant()
  const job = await queueWebsiteImport(site.id, 'https://firma.cz/', user.id, db!)
  await processWebsiteImport(job.id)
  return { site, job: await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } }) }
}
const event = (id: string, body: unknown) => ({ params: { id }, body }) as never

describe.skipIf(!enabled)('website import on PostgreSQL', () => {
  beforeAll(async () => {
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('useRuntimeConfig', () => ({
      anthropic: { apiKey: 'synthetic-key' },
      websiteImport: { dailyBudgetUsd: mocks.budget },
    }))
    vi.stubGlobal('reportCaughtError', mocks.report)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readValidatedBody', async (input: { body: unknown }, parse: (value: unknown) => unknown) =>
      parse(input.body),
    )
    vi.stubGlobal('getRouterParam', (input: { params: Record<string, string> }, name: string) => input.params[name])
    vi.stubGlobal('requireTenantScope', async (_event: unknown, scope: SessionUser['scopes'][number]) => {
      if (!user.scopes.includes(scope)) throw createError({ statusCode: 403 })
      return { user }
    })
    vi.stubGlobal('getEnhancedPrisma', async () =>
      db!.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true })).$setAuth(user),
    )
    vi.stubGlobal('requireAiPlan', async () => ({ plan: 'PREMIUM' }))
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('logAction', mocks.audit)
    vi.stubGlobal('invalidateFeed', vi.fn())
    apply = (await import('../../server/api/website-import/[id]/apply.post')).default
  })
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.budget = '100'
    mocks.index.mockResolvedValue(false)
    user.scopes = ['TENANT_SETTINGS', 'INTEGRATION_CONTROL']
    mocks.research.mockImplementation(async (_id, _site, sourceUrl) => ({
      text: 'Supported company evidence.',
      urls: [sourceUrl],
      usage,
    }))
    mocks.analyze.mockResolvedValue({
      values: {
        ...emptyWebsiteValues(),
        focus: 'Výběrová káva a domácí příprava.',
        audience: 'Začínající domácí baristé.',
        language: 'cs',
        keywords: ['káva', 'espresso'],
      },
      usage: { ...usage, searches: 0, estimatedCostMicros: 35 },
    })
    mocks.extract.mockImplementation(async (target, options) => {
      options.onHtml?.('<html><main>Company page.</main></html>')
      return {
        title: 'Company',
        content: `Public company facts at ${target}. Contact synthetic-person@firma.cz for details.`,
        mimeType: 'text/html',
      }
    })
  })
  afterAll(async () => {
    await db?.$disconnect()
    vi.unstubAllGlobals()
  })

  it('enforces one active onboarding import per tenant in the database', async () => {
    const site = await tenant()
    const jobs = await Promise.allSettled([
      queueWebsiteImport(site.id, 'firma.cz', user.id, db!),
      queueWebsiteImport(site.id, 'firma.cz', user.id, db!),
    ])
    expect(jobs.filter((job) => job.status === 'fulfilled')).toHaveLength(1)
    expect(await db!.websiteImport.count({ where: { clientSiteId: site.id } })).toBe(1)
  })

  it('claims once, leaves settings unchanged and prepares disabled knowledge without logging content', async () => {
    const site = await tenant()
    const job = await queueWebsiteImport(site.id, 'firma.cz', user.id, db!)
    await Promise.all([processWebsiteImport(job.id), processWebsiteImport(job.id)])
    expect(mocks.research).toHaveBeenCalledTimes(1)
    expect(mocks.analyze).toHaveBeenCalledTimes(1)
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({
      focus: null,
      audience: null,
    })
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'READY',
      budgetCostMicros: 110_070,
    })
    expect(await db!.knowledgeSource.findFirstOrThrow({ where: { websiteImportId: job.id } })).toMatchObject({
      useInArticles: false,
      sourceUrl: 'https://firma.cz/',
    })
    const input = mocks.analyze.mock.calls[0]![2]
    expect(JSON.stringify(input)).not.toContain('synthetic-person@firma.cz')
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('Public company facts')
  })

  it('keeps import creation outside the tenant-facing policy client', async () => {
    const site = await tenant()
    user.clientSiteId = site.id
    const enhanced = db!.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true })).$setAuth(user)
    await expect(queueWebsiteImport(site.id, 'firma.cz', user.id, enhanced)).rejects.toThrow()
    expect(await db!.websiteImport.count({ where: { clientSiteId: site.id } })).toBe(0)
  })

  it('terminates exhausted abandoned work instead of blocking the queue', async () => {
    const site = await tenant()
    const job = await queueWebsiteImport(site.id, 'firma.cz', user.id, db!)
    await db!.websiteImport.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', attempts: 3, leaseUntil: new Date(0) },
    })
    await drainWebsiteImports()
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'FAILED',
      errorCode: 'RETRY_LIMIT',
      attempts: 3,
    })
  })

  it('reserves the global budget atomically before dispatch and defers another tenant', async () => {
    const firstSite = await tenant()
    const secondSite = await tenant()
    const first = await queueWebsiteImport(firstSite.id, 'firma.cz', user.id, db!)
    const second = await queueWebsiteImport(secondSite.id, 'firma.cz', user.id, db!)
    const day = new Date()
    day.setUTCHours(0, 0, 0, 0)
    const aggregate = await db!.websiteImport.aggregate({ where: { budgetDay: day }, _sum: { budgetCostMicros: true } })
    mocks.budget = String(((aggregate._sum.budgetCostMicros ?? 0) + 4_000_000) / 1_000_000)
    let finish!: (value: unknown) => void
    mocks.research.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const running = processWebsiteImport(first.id)
    await vi.waitFor(() => expect(mocks.research).toHaveBeenCalledTimes(1))
    await processWebsiteImport(second.id)
    expect(mocks.research).toHaveBeenCalledTimes(1)
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
      status: 'PENDING',
      errorCode: 'DAILY_BUDGET',
      searchStartedAt: null,
      budgetCostMicros: 0,
      attempts: 0,
    })
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WEBSITE_IMPORT_BUDGET_DEFERRED',
        clientSiteId: secondSite.id,
        metadata: expect.objectContaining({ importId: second.id, stage: 'search' }),
      }),
    )
    finish({ text: 'Evidence', urls: ['https://firma.cz/'], usage })
    await running
  })

  it('logs budget deferral before analysis without repeating the saved search', async () => {
    const site = await tenant()
    const job = await queueWebsiteImport(site.id, 'firma.cz', user.id, db!)
    const previousDay = new Date(Date.now() - 86_400_000)
    previousDay.setUTCHours(0, 0, 0, 0)
    await db!.websiteImport.update({
      where: { id: job.id },
      data: {
        searchStartedAt: previousDay,
        searchCompletedAt: previousDay,
        searchText: 'Saved evidence',
        searchSources: ['https://firma.cz/'],
        budgetDay: previousDay,
        reservedCostMicros: 4_000_000,
        budgetCostMicros: 4_000_000,
      },
    })
    mocks.budget = '0'
    await processWebsiteImport(job.id)
    expect(mocks.research).not.toHaveBeenCalled()
    expect(mocks.analyze).not.toHaveBeenCalled()
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'PENDING',
      errorCode: 'DAILY_BUDGET',
      extractionStartedAt: null,
    })
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WEBSITE_IMPORT_BUDGET_DEFERRED',
        clientSiteId: site.id,
        metadata: expect.objectContaining({ importId: job.id, stage: 'analysis' }),
      }),
    )
  })

  it('never repeats an ambiguously completed search after a lost worker', async () => {
    const site = await tenant()
    const job = await queueWebsiteImport(site.id, 'firma.cz', user.id, db!)
    await db!.websiteImport.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        searchStartedAt: new Date(),
        leaseUntil: new Date(0),
        reservedCostMicros: 2_000_000,
        budgetCostMicros: 2_000_000,
      },
    })
    await processWebsiteImport(job.id)
    expect(mocks.research).not.toHaveBeenCalled()
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'FAILED',
      errorCode: 'SEARCH_OUTCOME_UNKNOWN',
      budgetCostMicros: 2_000_000,
    })
  })

  it.each(['Saved evidence', ''])('resumes a completed search without repeating it (brief: %s)', async (brief) => {
    const site = await tenant()
    const job = await queueWebsiteImport(site.id, 'firma.cz', user.id, db!)
    await db!.websiteImport.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        searchStartedAt: new Date(),
        searchCompletedAt: new Date(),
        searchText: brief,
        searchSources: ['https://firma.cz/'],
        leaseUntil: new Date(0),
        budgetCostMicros: 2_000_000,
      },
    })
    await processWebsiteImport(job.id)
    expect(mocks.research).not.toHaveBeenCalled()
    expect(mocks.analyze).toHaveBeenCalledTimes(1)
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'READY',
      budgetCostMicros: 4_000_000,
    })
  })

  it('never repeats an ambiguously completed extraction', async () => {
    const site = await tenant()
    const job = await queueWebsiteImport(site.id, 'firma.cz', user.id, db!)
    await db!.websiteImport.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        searchStartedAt: new Date(),
        searchCompletedAt: new Date(),
        extractionStartedAt: new Date(),
        leaseUntil: new Date(0),
      },
    })
    await processWebsiteImport(job.id)
    expect(mocks.research).not.toHaveBeenCalled()
    expect(mocks.analyze).not.toHaveBeenCalled()
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'FAILED',
      errorCode: 'ANALYSIS_OUTCOME_UNKNOWN',
    })
  })

  it('returns usable partial results when a page fails', async () => {
    mocks.research.mockResolvedValue({ text: 'Evidence', urls: ['https://firma.cz/', 'https://firma.cz/about'], usage })
    mocks.extract.mockRejectedValueOnce(new Error('synthetic network failure'))
    const { job } = await run()
    expect(job.status).toBe('READY')
    expect(job.result).toMatchObject({ warnings: ['pageFailed'] })
  })

  it('retains the reservation and does not invent content after extraction failure', async () => {
    mocks.analyze.mockRejectedValueOnce(new Error('synthetic provider failure'))
    const { job } = await run()
    expect(job).toMatchObject({ status: 'READY', budgetCostMicros: 4_000_000 })
    expect(job.result).toMatchObject({ values: { focus: null, audience: null }, warnings: ['analysisFailed'] })
  })

  it('applies only selected fields and is idempotent', async () => {
    const { site, job } = await run()
    user.clientSiteId = site.id
    const enhanced = db!.$use(new PolicyPlugin({ dangerouslyAllowRawSql: true })).$setAuth(user)
    const view = await websiteImportView(site.id, enhanced)
    const body = { fields: ['focus'], values: view.import!.result!.values, expected: view.import!.expected }
    await apply(event(job.id, body))
    await apply(event(job.id, body))
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({
      focus: 'Výběrová káva a domácí příprava.',
      audience: null,
    })
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: 'REVIEWED',
      acceptedFields: ['focus'],
      reviewedById: user.id,
    })
    expect(await db!.knowledgeSource.findFirstOrThrow({ where: { websiteImportId: job.id } })).toMatchObject({
      useInArticles: false,
    })
  })

  it('rejects stale field edits atomically', async () => {
    const { site, job } = await run()
    user.clientSiteId = site.id
    const view = await websiteImportView(site.id, db!)
    await db!.clientSite.update({ where: { id: site.id }, data: { focus: 'New human edit' } })
    await expect(
      apply(
        event(job.id, {
          fields: ['focus', 'audience'],
          values: view.import!.result!.values,
          expected: view.import!.expected,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409, data: { code: 'WEBSITE_CONFLICT' } })
    expect(await db!.clientSite.findUniqueOrThrow({ where: { id: site.id } })).toMatchObject({
      focus: 'New human edit',
      audience: null,
    })
    expect(await db!.websiteImport.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'READY' })
  })

  it('activates only the accepted import sources and queues their existing indexer', async () => {
    const { site, job } = await run()
    user.clientSiteId = site.id
    const view = await websiteImportView(site.id, db!)
    await apply(
      event(job.id, { fields: ['knowledge'], values: view.import!.result!.values, expected: view.import!.expected }),
    )
    const source = await db!.knowledgeSource.findFirstOrThrow({ where: { websiteImportId: job.id } })
    expect(source.useInArticles).toBe(true)
    expect(mocks.index).toHaveBeenCalledWith(source.id)
  })

  it('cannot apply another tenant import or expose its internal search text', async () => {
    const { site, job } = await run()
    const view = await websiteImportView(site.id, db!)
    expect(view.import).not.toHaveProperty('searchText')
    expect(view.import).not.toHaveProperty('baseline')
    user.clientSiteId = (await tenant()).id
    await expect(
      apply(event(job.id, { fields: ['focus'], values: view.import!.result!.values, expected: view.import!.expected })),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('enforces integration permission when accepting social links', async () => {
    const { site, job } = await run()
    user.clientSiteId = site.id
    user.scopes = ['TENANT_SETTINGS']
    const view = await websiteImportView(site.id, db!)
    await expect(
      apply(
        event(job.id, { fields: ['socials'], values: view.import!.result!.values, expected: view.import!.expected }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('serializes knowledge quotas and deduplicates content across imports', async () => {
    const site = await tenant()
    await db!.clientSite.update({ where: { id: site.id }, data: { plan: 'PRO' } })
    await db!.knowledgeSource.createMany({
      data: Array.from({ length: 49 }, (_, index) => ({
        clientSiteId: site.id,
        kind: 'NOTE' as const,
        title: `Fixture ${index}`,
        content: 'Synthetic fixture content',
        contentHash: websiteValueHash(index),
      })),
    })
    const data = (content: string) => ({
      clientSiteId: site.id,
      kind: 'URL' as const,
      title: 'Company',
      sourceUrl: 'https://firma.cz/',
      content,
      contentHash: websiteValueHash(content),
      useInArticles: false,
    })
    const outcomes = await Promise.allSettled([
      createKnowledgeSource(db!, data('First public company source')),
      createKnowledgeSource(db!, data('Second public company source')),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(await db!.knowledgeSource.count({ where: { clientSiteId: site.id } })).toBe(50)
    const existing = await db!.knowledgeSource.findFirstOrThrow({ where: { clientSiteId: site.id, kind: 'URL' } })
    const reused = await createKnowledgeSource(db!, data(existing.content))
    expect(reused.reused).toBe(true)
  })
})

beforeEach(stubImports)
