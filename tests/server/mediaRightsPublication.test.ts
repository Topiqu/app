import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { evaluateMediaRights, requireMediaRightsReview } from '../../server/utils/mediaRights'
import { buildMediaRightsItems, extractArticleMedia, mediaRightsCounts } from '../../shared/utils/mediaRights'

beforeEach(() => {
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('extractArticleMedia', extractArticleMedia)
  vi.stubGlobal('buildMediaRightsItems', buildMediaRightsItems)
  vi.stubGlobal('mediaRightsCounts', mediaRightsCounts)
  vi.stubGlobal('evaluateMediaRights', evaluateMediaRights)
})
afterEach(() => vi.unstubAllGlobals())

describe('publication media acknowledgements', () => {
  const input = { imageUrl: 'https://images.test/cover.jpg' }
  const publication = { articleId: 'article-1', language: 'cs' as const }
  const setup = () => {
    const acknowledgement = vi.fn().mockResolvedValue(null)
    const db = {
      mediaAsset: { findMany: vi.fn().mockResolvedValue([]) },
      mediaRightsPublicationSnapshot: { findFirst: acknowledgement },
    } as unknown as Parameters<typeof requireMediaRightsReview>[0]
    return { db, acknowledgement }
  }

  it('reuses the confirmed fingerprint only within the same tenant, article and language', async () => {
    const { db, acknowledgement } = setup()
    acknowledgement.mockResolvedValue({ id: 'snapshot-1' })
    const report = await requireMediaRightsReview(db, 'site-1', input, undefined, publication)
    expect(report.counts.needsAttention).toBeGreaterThan(0)
    expect(acknowledgement).toHaveBeenCalledWith({
      where: {
        clientSiteId: 'site-1',
        articleId: 'article-1',
        language: 'cs',
        fingerprint: report.fingerprint,
        overrideConfirmed: true,
        confirmedById: { not: null },
      },
      select: { id: true },
    })
  })

  it('requires a new acknowledgement when the media collection changes', async () => {
    const { db, acknowledgement } = setup()
    const previous = await evaluateMediaRights(db, 'site-1', input)
    acknowledgement.mockImplementation(({ where }) =>
      where.fingerprint === previous.fingerprint ? { id: 'snapshot-1' } : null,
    )
    await expect(
      requireMediaRightsReview(db, 'site-1', { imageUrl: 'https://images.test/new-cover.jpg' }, undefined, publication),
    ).rejects.toMatchObject({ statusCode: 409, data: { code: 'MEDIA_RIGHTS_REVIEW_REQUIRED' } })
  })

  it('never borrows an article acknowledgement for a newly created article', async () => {
    const { db, acknowledgement } = setup()
    await expect(requireMediaRightsReview(db, 'site-1', input)).rejects.toMatchObject({ statusCode: 409 })
    expect(acknowledgement).not.toHaveBeenCalled()
  })
})
