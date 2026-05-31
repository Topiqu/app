import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  draftPost: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(async () => ({})),
  },
  publishedPost: {
    create: vi.fn(async () => ({})),
  },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
}

const createPost = vi.fn(async () => 'urn:li:share:123')

vi.mock('../../../server/utils/prisma', () => ({ default: prismaMock }))
vi.mock('../../../server/utils/linkedin/api', () => ({ createPost }))

const { publishApprovedDraft, executePublish } = await import('../../../server/utils/linkedin/publisher')

const draftWithToken = {
  id: 'draft-1',
  text: 'hello',
  task: { company: { accessToken: 'tok', linkedinOrgId: 'urn:li:org:1' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.GLOBAL_KILL_SWITCH
  prismaMock.draftPost.findUniqueOrThrow.mockResolvedValue(draftWithToken)
})

describe('executePublish — atomic claim', () => {
  it('publishes exactly once when the claim is won', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })

    const result = await publishApprovedDraft('draft-1')

    expect(prismaMock.draftPost.updateMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', status: { in: ['APPROVED'] } },
      data: { status: 'PUBLISHING' },
    })
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

  it('releases the claim to FAILED when the LinkedIn call throws', async () => {
    prismaMock.draftPost.updateMany.mockResolvedValue({ count: 1 })
    createPost.mockRejectedValueOnce(new Error('LinkedIn down'))

    await expect(publishApprovedDraft('draft-1')).rejects.toThrow('LinkedIn down')

    expect(prismaMock.draftPost.update).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
      data: { status: 'FAILED' },
    })
    expect(prismaMock.publishedPost.create).not.toHaveBeenCalled()
  })

  it('refuses to claim when the global kill switch is active', async () => {
    process.env.GLOBAL_KILL_SWITCH = 'true'

    await expect(executePublish('draft-1', ['APPROVED'])).rejects.toThrow('emergency stop')

    expect(prismaMock.draftPost.updateMany).not.toHaveBeenCalled()
    expect(createPost).not.toHaveBeenCalled()
  })
})
