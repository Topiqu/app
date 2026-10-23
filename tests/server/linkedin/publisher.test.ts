import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/linkedin/token'), 'getValidAccessToken')
  await stubNitroImports(
    import('../../../server/utils/linkedin/api'),
    'isLinkedInPostUrn',
    'LinkedInPostError',
    'createPost',
    'refreshAccessToken',
  )
}

const prismaMock = {
  draftPost: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(async () => ({})),
  },
  publishedPost: {
    create: vi.fn(async () => ({})),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}

const createPost = vi.fn(async () => 'urn:li:share:123')

vi.mock('../../../server/utils/prisma', () => ({ default: prismaMock }))
vi.mock('../../../server/utils/linkedin/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/linkedin/api')>()),
  createPost,
}))

await stubImports()

const { publishApprovedDraft, executePublish, publishDecisionAndExecute, reconcilePublishedDraft } =
  await import('../../../server/utils/linkedin/publisher')
const { LinkedInPostError } = await import('../../../server/utils/linkedin/api')

const draftWithToken = {
  id: 'draft-1',
  text: 'hello',
  task: {
    company: {
      accessToken: 'tok',
      linkedinOrgId: 'urn:li:org:1',
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      clientSite: { publishToLinkedIn: true },
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  prismaMock.draftPost.findUniqueOrThrow.mockResolvedValue(draftWithToken)
  prismaMock.draftPost.findUnique.mockResolvedValue({ status: 'APPROVED' })
  prismaMock.publishedPost.findUnique.mockResolvedValue(null)
  prismaMock.$transaction.mockImplementation(async (run) => run(prismaMock))
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
})
afterEach(() => vi.unstubAllGlobals())

describe('executePublish — atomic claim', () => {
  it('pauses an approved post after the tenant disables LinkedIn and resumes after enabling it', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.draftPost.findUniqueOrThrow.mockResolvedValueOnce({
      ...draftWithToken,
      task: { company: { ...draftWithToken.task.company, clientSite: { publishToLinkedIn: false } } },
    })
    await expect(publishApprovedDraft('draft-1')).resolves.toEqual({ status: 'skipped' })
    expect(prismaMock.draftPost.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'draft-1', status: 'PUBLISHING' }),
        data: expect.objectContaining({ status: 'APPROVED', publicationAttemptedAt: null }),
      }),
    )
    expect(prismaMock.draftPost.update).not.toHaveBeenCalled()
    expect(createPost).not.toHaveBeenCalled()
    expect(prismaMock.publishedPost.create).not.toHaveBeenCalled()

    await expect(publishApprovedDraft('draft-1')).resolves.toEqual({ status: 'published', urn: 'urn:li:share:123' })
    expect(createPost).toHaveBeenCalledOnce()
  })
  it('publishes exactly once when the claim is won', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })

    const result = await publishApprovedDraft('draft-1')

    expect(prismaMock.draftPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'draft-1',
          status: 'APPROVED',
          task: { deletedAt: null, company: { deletedAt: null, clientSite: { publishToLinkedIn: true } } },
        }),
        data: expect.objectContaining({ status: 'PUBLISHING', publicationAttemptedAt: expect.any(Date) }),
      }),
    )
    expect(createPost).toHaveBeenCalledTimes(1)
    expect(prismaMock.publishedPost.create).toHaveBeenCalledWith({
      data: { draftId: 'draft-1', linkedinPostId: 'urn:li:share:123' },
    })
    expect(result).toEqual({ status: 'published', urn: 'urn:li:share:123' })
  })

  it('does NOT hit LinkedIn when the claim is lost (concurrent run already took it)', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 0 })

    const result = await publishApprovedDraft('draft-1')

    expect(createPost).not.toHaveBeenCalled()
    expect(prismaMock.publishedPost.create).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'skipped' })
  })

  it('keeps an unknown LinkedIn outcome locked instead of making it retryable', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    createPost.mockRejectedValueOnce(new Error('LinkedIn down'))

    await expect(publishApprovedDraft('draft-1')).resolves.toEqual({ status: 'needs_review' })
    expect(prismaMock.draftPost.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'draft-1', status: 'PUBLISHING' },
      data: { publicationError: 'REMOTE_OUTCOME_UNKNOWN' },
    })
    expect(prismaMock.draftPost.update).not.toHaveBeenCalled()
    expect(prismaMock.publishedPost.create).not.toHaveBeenCalled()
  })

  it('never makes an accepted remote post retryable when local persistence fails', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockRejectedValueOnce(new Error('synthetic persistence failure'))
    await expect(publishApprovedDraft('draft-1')).resolves.toMatchObject({ status: 'needs_review' })
    expect(createPost).toHaveBeenCalledTimes(1)
    expect(prismaMock.draftPost.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    )
  })

  it('records the confirmed remote ID before local finalization', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    await publishApprovedDraft('draft-1')
    const journalCall = prismaMock.draftPost.updateMany.mock.calls.findIndex(
      ([args]) => args.data.publicationUrn === 'urn:li:share:123',
    )
    expect(journalCall).toBeGreaterThanOrEqual(0)
    expect(prismaMock.draftPost.updateMany.mock.invocationCallOrder[journalCall]).toBeLessThan(
      prismaMock.$transaction.mock.invocationCallOrder[0]!,
    )
  })

  it('preserves a confirmed remote ID when the first journal write fails transiently', async () => {
    prismaMock.draftPost.updateMany.mockImplementation(async ({ where, data }) => {
      if (data.publicationUrn && where.publicationAttemptedAt) throw new Error('synthetic journal outage')
      return { count: 1 }
    })
    await expect(publishApprovedDraft('draft-1')).resolves.toMatchObject({ status: 'needs_review' })
    expect(prismaMock.draftPost.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { publicationError: 'LOCAL_JOURNAL_FAILED', publicationUrn: 'urn:li:share:123' },
      }),
    )
    expect(createPost).toHaveBeenCalledTimes(1)
  })

  it('makes only a definitive rejected create retryable', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    createPost.mockRejectedValueOnce(new LinkedInPostError('rejected', 403))
    await expect(publishApprovedDraft('draft-1')).rejects.toThrow('REJECTED_403')
    expect(prismaMock.draftPost.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'FAILED', publicationError: 'REJECTED_403' } }),
    )
  })

  it('quarantines legacy FAILED outcomes without issuing another remote create', async () => {
    prismaMock.draftPost.findUnique.mockResolvedValue({ status: 'FAILED', publicationError: null })
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    await expect(executePublish('draft-1', ['FAILED'])).resolves.toEqual({ status: 'needs_review' })
    expect(createPost).not.toHaveBeenCalled()
    expect(prismaMock.draftPost.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PUBLISHING', publicationError: 'LEGACY_OUTCOME_UNKNOWN' } }),
    )
  })

  it('never resets an uncertain HitL publication into approval', async () => {
    prismaMock.draftPost.findUnique.mockResolvedValue({ ...draftWithToken, status: 'PUBLISHING', publicationUrn: null })
    await expect(publishDecisionAndExecute('draft-1')).resolves.toEqual({ status: 'needs_review' })
    expect(createPost).not.toHaveBeenCalled()
    expect(prismaMock.draftPost.updateMany).not.toHaveBeenCalled()
  })

  it('reconciles a journaled confirmed ID using local writes only', async () => {
    prismaMock.draftPost.findUnique.mockResolvedValue({ status: 'PUBLISHING', publicationUrn: 'urn:li:share:123' })
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    await expect(reconcilePublishedDraft('draft-1')).resolves.toEqual({ status: 'published', urn: 'urn:li:share:123' })
    expect(createPost).not.toHaveBeenCalled()
  })

  it('refuses to claim when the global kill switch is active', async () => {
    vi.stubEnv('GLOBAL_KILL_SWITCH', 'true')

    await expect(executePublish('draft-1', ['APPROVED'])).rejects.toThrow('emergency stop')

    expect(prismaMock.draftPost.updateMany).not.toHaveBeenCalled()
    expect(createPost).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)
