import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/translationRow'), 'nextTranslationVersion')
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

const setup = async () => {
  let status = 'PENDING'
  let version: Date | null = new Date('2020-01-01T00:00:00Z')
  let content = 'Original translation'
  let sourceVersion = 1
  const mutations: { status?: string; updatedAt?: Date }[] = []
  const updateMany = vi.fn(async ({ where, data }) => {
    if (
      where.id &&
      where.status &&
      (typeof where.status === 'string' ? status !== where.status : !where.status.in.includes(status))
    )
      return { count: 0 }
    if (!where.id) return { count: 0 }
    if (where.updatedAt instanceof Date && version?.getTime() !== where.updatedAt.getTime()) return { count: 0 }
    mutations.push(data)
    if (data.status) status = data.status
    if (data.updatedAt) version = data.updatedAt
    if (data.content) content = data.content
    return { count: 1 }
  })
  const translation = {
    updateMany,
    findMany: async () => [{ id: 'translation-1', updatedAt: version }],
    findUnique: async () => ({
      id: 'translation-1',
      language: 'en',
      clientSiteId: 'site-1',
      article: { id: 'article-1', title: 'Source', content: '<p>Original source.</p>', editVersion: sourceVersion },
      clientSite: { translationMode: 'AUTO', publishToWeb: true },
    }),
  }
  const db = {
    articleTranslation: translation,
    $queryRaw: async () => [{ editVersion: sourceVersion }],
    $transaction: async (run: (tx: unknown) => unknown) => run(db),
  }
  const generate = vi.fn(async () => ({
    title: 'Translated',
    excerpt: null,
    content: '<p>Translated.</p>',
    slug: 'translated',
    answer: null,
    keyTakeaways: [],
    faq: [],
    usage: { totalTokens: 10 },
  }))
  const announce = vi.fn()
  const usage = vi.fn().mockResolvedValue(undefined)
  const report = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('defineMonitoredTask', (task: unknown) => task)
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('activeFeatureFilter', () => ({}))
  vi.stubGlobal('generateTranslation', generate)
  vi.stubGlobal('recordAiUsage', usage)
  vi.stubGlobal('dedupeTranslationSlug', async () => 'translated')
  vi.stubGlobal('sanitizeHtml', (html: string) => html)
  vi.stubGlobal('aiModelId', () => 'translation-model')
  vi.stubGlobal('toDatabaseJson', (value: unknown) => value)
  vi.stubGlobal('syncArticleMediaUsages', vi.fn())
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
  vi.stubGlobal('announceArticle', announce)
  vi.stubGlobal('reportCaughtError', report)
  const task = (await import('../../../server/tasks/translate-pending')).default as {
    run: () => Promise<{ result: { processed: number; failed: number; skipped: number } }>
  }
  return {
    run: () => task.run(),
    generate,
    announce,
    usage,
    report,
    mutations,
    state: () => ({ status, version, content }),
    changeSource: () => {
      sourceVersion++
    },
    humanSave: () => {
      status = 'READY'
      version = new Date(Date.now() + 10)
      content = 'Human edit'
    },
  }
}

describe('queued translation ownership', () => {
  it('requeues a translation when the source changes while the provider is running', async () => {
    const fixture = await setup()
    fixture.generate.mockImplementationOnce(async () => {
      fixture.changeSource()
      return {
        title: 'Outdated',
        excerpt: null,
        content: '<p>Outdated.</p>',
        slug: 'outdated',
        answer: null,
        keyTakeaways: [],
        faq: [],
        usage: { totalTokens: 10 },
      }
    })
    const result = await fixture.run()
    expect(fixture.state()).toMatchObject({ status: 'STALE', content: 'Original translation' })
    expect(result.result).toMatchObject({ processed: 0, skipped: 1 })
    expect(fixture.announce).not.toHaveBeenCalled()
  })

  it('advances the edit token after publishing instead of reusing the worker claim', async () => {
    const fixture = await setup()
    await fixture.run()
    const claim = fixture.mutations.find((row) => row.status === 'TRANSLATING')!
    expect(fixture.state().status).toBe('PUBLISHED')
    expect(fixture.state().version!.getTime()).toBeGreaterThan(claim.updatedAt!.getTime())
  })

  it('keeps a human edit that replaced the worker claim', async () => {
    const fixture = await setup()
    fixture.generate.mockImplementationOnce(async () => {
      fixture.humanSave()
      return {
        title: 'AI output',
        excerpt: null,
        content: '<p>AI output.</p>',
        slug: 'output',
        answer: null,
        keyTakeaways: [],
        faq: [],
        usage: { totalTokens: 10 },
      }
    })
    const result = await fixture.run()
    expect(fixture.state()).toMatchObject({ status: 'READY', content: 'Human edit' })
    expect(result.result).toMatchObject({ processed: 0, skipped: 1 })
    expect(fixture.announce).not.toHaveBeenCalled()
  })

  it('does not classify a committed translation as failed when announcing fails', async () => {
    const fixture = await setup()
    fixture.announce.mockRejectedValueOnce(new Error('Notification delivery unavailable'))
    const result = await fixture.run()
    expect(fixture.state().status).toBe('PUBLISHED')
    expect(result.result).toMatchObject({ processed: 1, failed: 0 })
    expect(fixture.report).toHaveBeenCalled()
  })

  it('persists a completed translation when internal metering is unavailable', async () => {
    const fixture = await setup()
    fixture.usage.mockRejectedValueOnce(new Error('Internal usage write unavailable'))
    const result = await fixture.run()
    expect(fixture.state().status).toBe('PUBLISHED')
    expect(result.result).toMatchObject({ processed: 1, failed: 0 })
    expect(fixture.report).toHaveBeenCalled()
  })
})

beforeEach(stubImports)
