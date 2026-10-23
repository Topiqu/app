// @vitest-environment node

import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDatabaseClient } from '../../../server/utils/database'

const { createPost } = vi.hoisted(() => ({ createPost: vi.fn() }))
vi.mock('../../../server/utils/linkedin/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/linkedin/api')>()),
  createPost,
}))
vi.mock('../../../server/utils/prisma', () => ({ default: db }))

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url) : null
const sites: string[] = []
const signal = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const fixture = async () => {
  const clientSiteId = randomUUID()
  sites.push(clientSiteId)
  await db!.clientSite.create({
    data: {
      id: clientSiteId,
      name: `linkedin-${clientSiteId}`,
      domain: `${clientSiteId}.test`,
      publishToLinkedIn: true,
    },
  })
  const company = await db!.linkedinCompany.create({
    data: {
      clientSiteId,
      name: 'Offline LinkedIn test',
      linkedinOrgId: `urn:li:person:${randomUUID()}`,
      type: 'personal',
      mode: 'FullAuto',
      accessToken: 'offline-token',
      tokenExpiresAt: new Date(Date.now() + 3_600_000),
    },
  })
  const task = await db!.contentTask.create({
    data: {
      companyId: company.id,
      topic: 'Offline publication test',
      dueAt: new Date(),
      status: 'COMPLETED',
    },
  })
  const draft = await db!.draftPost.create({
    data: { taskId: task.id, text: 'Offline content.', score: 90, status: 'APPROVED' },
  })
  return { ...draft, clientSiteId }
}

describe.skipIf(!enabled)('LinkedIn publication safety on PostgreSQL', () => {
  beforeEach(() => {
    createPost.mockReset().mockResolvedValue('urn:li:share:123456789')
    vi.unstubAllEnvs()
    vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('logAction', vi.fn().mockResolvedValue(undefined))
  })
  afterEach(async () => {
    if (db) await db.clientSite.deleteMany({ where: { id: { in: sites } } })
    sites.length = 0
    vi.unstubAllGlobals()
  })
  afterAll(async () => db?.$disconnect())

  it('allows one remote POST across overlapping publishers and retains the in-flight lock', async () => {
    const draft = await fixture()
    const started = signal()
    const release = signal()
    createPost.mockImplementation(async () => {
      started.resolve()
      await release.promise
      return 'urn:li:share:123456789'
    })
    const { publishApprovedDraft } = await import('../../../server/utils/linkedin/publisher')
    const first = publishApprovedDraft(draft.id)
    await started.promise
    const second = await publishApprovedDraft(draft.id)
    release.resolve()
    await expect(first).resolves.toMatchObject({ status: 'published' })
    expect(second).toMatchObject({ status: 'needs_review' })
    expect(createPost).toHaveBeenCalledTimes(1)
    expect(await db!.publishedPost.count({ where: { draftId: draft.id } })).toBe(1)
    expect(await db!.draftPost.findUnique({ where: { id: draft.id } })).toMatchObject({ status: 'PUBLISHED' })
  })

  it('retains a confirmed remote ID across a failed finalization and reconciles it locally', async () => {
    const draft = await fixture()
    const conflicting = await fixture()
    await db!.publishedPost.create({ data: { draftId: conflicting.id, linkedinPostId: 'urn:li:share:123456789' } })
    const { publishApprovedDraft, reconcilePublishedDraft } = await import('../../../server/utils/linkedin/publisher')
    await expect(publishApprovedDraft(draft.id)).resolves.toMatchObject({ status: 'needs_review' })
    expect(await db!.draftPost.findUnique({ where: { id: draft.id } })).toMatchObject({
      status: 'PUBLISHING',
      publicationUrn: 'urn:li:share:123456789',
      publicationError: 'LOCAL_FINALIZATION_FAILED',
    })
    await db!.publishedPost.deleteMany({ where: { draftId: conflicting.id } })
    await expect(reconcilePublishedDraft(draft.id)).resolves.toMatchObject({ status: 'published' })
    expect(createPost).toHaveBeenCalledTimes(1)
    expect(await db!.publishedPost.count({ where: { draftId: draft.id } })).toBe(1)
  })

  it('keeps remote ambiguity locked through both scheduled and manual publish callers', async () => {
    const draft = await fixture()
    createPost.mockRejectedValue(new Error('synthetic lost acknowledgement'))
    const { publishApprovedDraft, publishDecisionAndExecute } = await import('../../../server/utils/linkedin/publisher')
    await expect(publishApprovedDraft(draft.id)).resolves.toMatchObject({ status: 'needs_review' })
    await expect(publishDecisionAndExecute(draft.id)).resolves.toMatchObject({ status: 'needs_review' })
    await expect(publishApprovedDraft(draft.id)).resolves.toMatchObject({ status: 'needs_review' })
    expect(createPost).toHaveBeenCalledTimes(1)
    expect(await db!.draftPost.findUnique({ where: { id: draft.id } })).toMatchObject({
      status: 'PUBLISHING',
      publicationUrn: null,
      publicationError: 'REMOTE_OUTCOME_UNKNOWN',
    })
  })

  it('quarantines a legacy FAILED outcome instead of reposting it', async () => {
    const draft = await fixture()
    await db!.draftPost.update({ where: { id: draft.id }, data: { status: 'FAILED' } })
    const { publishApprovedDraft } = await import('../../../server/utils/linkedin/publisher')
    await expect(publishApprovedDraft(draft.id)).resolves.toMatchObject({ status: 'needs_review' })
    expect(createPost).not.toHaveBeenCalled()
    expect(await db!.draftPost.findUnique({ where: { id: draft.id } })).toMatchObject({
      status: 'PUBLISHING',
      publicationError: 'LEGACY_OUTCOME_UNKNOWN',
    })
  })

  it('serializes overlapping local reconciliations into one PublishedPost', async () => {
    const draft = await fixture()
    await db!.draftPost.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHING', publicationUrn: 'urn:li:share:123456789' },
    })
    const { reconcilePublishedDraft } = await import('../../../server/utils/linkedin/publisher')
    const results = await Promise.all([reconcilePublishedDraft(draft.id), reconcilePublishedDraft(draft.id)])
    expect(results.every((result) => result.status === 'published')).toBe(true)
    expect(createPost).not.toHaveBeenCalled()
    expect(await db!.publishedPost.count({ where: { draftId: draft.id } })).toBe(1)
  })

  it('rolls back manual confirmation if its required audit fails, then permits local recovery', async () => {
    const draft = await fixture()
    await db!.draftPost.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHING', publicationAttemptedAt: new Date(Date.now() - 180_000) },
    })
    const { reconcilePublishedDraft } = await import('../../../server/utils/linkedin/publisher')
    const confirmation = {
      urn: 'urn:li:share:123456789',
      clientSiteId: draft.clientSiteId,
      reviewerId: 'offline-reviewer',
    }
    vi.mocked(logAction).mockRejectedValueOnce(new Error('synthetic audit outage'))
    await expect(reconcilePublishedDraft(draft.id, confirmation)).rejects.toThrow('synthetic audit outage')
    expect(await db!.draftPost.findUnique({ where: { id: draft.id } })).toMatchObject({
      status: 'PUBLISHING',
      publicationUrn: null,
    })
    expect(await db!.publishedPost.count({ where: { draftId: draft.id } })).toBe(0)
    await expect(reconcilePublishedDraft(draft.id, confirmation)).resolves.toMatchObject({ status: 'published' })
    expect(createPost).not.toHaveBeenCalled()
  })

  it('never reconciles a draft for another tenant or a new in-flight attempt', async () => {
    const draft = await fixture()
    await db!.draftPost.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHING', publicationAttemptedAt: new Date() },
    })
    const { reconcilePublishedDraft } = await import('../../../server/utils/linkedin/publisher')
    const confirmation = {
      urn: 'urn:li:share:123456789',
      clientSiteId: draft.clientSiteId,
      reviewerId: 'offline-reviewer',
    }
    await expect(
      reconcilePublishedDraft(draft.id, { ...confirmation, clientSiteId: 'another-tenant' }),
    ).resolves.toMatchObject({ status: 'skipped' })
    await expect(reconcilePublishedDraft(draft.id, confirmation)).rejects.toMatchObject({ statusCode: 409 })
    expect(logAction).not.toHaveBeenCalled()
    expect(createPost).not.toHaveBeenCalled()
    expect(await db!.publishedPost.count({ where: { draftId: draft.id } })).toBe(0)
  })
})
