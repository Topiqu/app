import { describe, expect, it } from 'vitest'

import type { MediaAssetRecord } from '../../shared/types/mediaRights'

import {
  buildMediaRightsItems,
  extractArticleMedia,
  mediaRightsCounts,
  mediaRightsIssues,
  setImageMediaId,
} from '../../shared/utils/mediaRights'

const asset = (overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord => ({
  id: '11111111-1111-4111-8111-111111111111',
  url: 'https://cdn.topiqu.test/uploads/photo.jpg',
  origin: 'UNKNOWN',
  attributionRequired: false,
  ...overrides,
})

describe('media rights analysis', () => {
  it('finds the shared cover and body images with stable block positions', () => {
    expect(
      extractArticleMedia({
        imageUrl: '/cover.jpg',
        coverMediaId: 'cover-id',
        content: '<h2>Title</h2><p>Text <img src="/one.jpg" data-media-id="one-id"></p><p>More</p>',
      }),
    ).toEqual([
      { key: 'cover', placement: 'cover', url: '/cover.jpg', mediaId: 'cover-id' },
      {
        key: 'body:1:0:/one.jpg',
        placement: 'body',
        url: '/one.jpg',
        mediaId: 'one-id',
        blockIndex: 1,
      },
    ])
  })

  it('does not treat missing metadata as evidence that rights are recorded', () => {
    const occurrence = { key: 'cover', placement: 'cover' as const, url: '/photo.jpg' }
    expect(mediaRightsIssues(occurrence, null).map((issue) => issue.code)).toContain('missing-origin')
    expect(mediaRightsIssues(occurrence, asset()).map((issue) => issue.code)).toContain('missing-origin')
  })

  it('accepts Topiqu-generated provenance without claiming a legal guarantee', () => {
    const occurrence = { key: 'cover', placement: 'cover' as const, url: '/ai.webp', mediaId: 'ai' }
    expect(mediaRightsIssues(occurrence, asset({ id: 'ai', origin: 'TOPIQU_AI' }))).toEqual([])
  })

  it('requires a user confirmation for own and externally generated media', () => {
    const occurrence = { key: 'cover', placement: 'cover' as const, url: '/photo.jpg', mediaId: 'own' }
    expect(mediaRightsIssues(occurrence, asset({ id: 'own', origin: 'OWN' })).map((issue) => issue.code)).toContain(
      'permission-unconfirmed',
    )
    expect(mediaRightsIssues(occurrence, asset({ id: 'own', origin: 'OWN', rightsConfirmedAt: new Date() }))).toEqual(
      [],
    )
  })

  it('requires source, author, license and attribution for Creative Commons media', () => {
    const occurrence = { key: 'body', placement: 'body' as const, url: '/cc.jpg', mediaId: 'cc' }
    const codes = mediaRightsIssues(
      occurrence,
      asset({ id: 'cc', origin: 'CREATIVE_COMMONS', attributionRequired: true }),
    ).map((issue) => issue.code)
    expect(codes).toEqual(
      expect.arrayContaining(['missing-source', 'missing-license', 'missing-author', 'missing-attribution']),
    )
  })

  it('surfaces embedded copyright as a review signal rather than a definitive failure', () => {
    const occurrence = { key: 'cover', placement: 'cover' as const, url: '/photo.jpg', mediaId: 'own' }
    expect(
      mediaRightsIssues(
        occurrence,
        asset({
          id: 'own',
          origin: 'OWN',
          rightsConfirmedAt: new Date(),
          metadataSignals: { copyright: 'Another photographer' },
        }),
      ),
    ).toContainEqual({ code: 'copyright-metadata', severity: 'info' })
  })

  it('marks external hotlinks as informational when their rights are otherwise recorded', () => {
    const occurrence = {
      key: 'body',
      placement: 'body' as const,
      url: 'https://images.example.com/photo.jpg',
      mediaId: 'cc',
    }
    const issues = mediaRightsIssues(
      occurrence,
      asset({
        id: 'cc',
        origin: 'CREATIVE_COMMONS',
        sourceUrl: 'https://example.com/photo',
        author: 'Author',
        license: 'CC BY 4.0',
        attribution: 'Author · CC BY 4.0',
        attributionRequired: true,
      }),
    )
    expect(issues).toEqual([{ code: 'hotlinked', severity: 'info' }])
  })

  it('derives report counts from warning-level readiness', () => {
    const known = asset({ origin: 'TOPIQU_AI' })
    const items = buildMediaRightsItems(
      { imageUrl: known.url, coverMediaId: known.id, content: '<p><img src="/unknown.jpg"></p>' },
      [known],
    )
    expect(mediaRightsCounts(items)).toEqual({ total: 2, recorded: 1, needsAttention: 1 })
  })

  it('reports duplicate media without turning recorded provenance into a failure', () => {
    const known = asset({ origin: 'TOPIQU_AI', contentHash: 'same-image' })
    const items = buildMediaRightsItems(
      {
        imageUrl: known.url,
        coverMediaId: known.id,
        content: `<p><img src="${known.url}" data-media-id="${known.id}"></p>`,
      },
      [known],
    )
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.state === 'recorded')).toBe(true)
    expect(items.every((item) => item.issues.some((issue) => issue.code === 'duplicate-media'))).toBe(true)
  })

  it('blocks unsupported media URL schemes even when provenance is known', () => {
    const known = asset({ url: 'javascript:alert(1)', origin: 'TOPIQU_AI' })
    const [item] = buildMediaRightsItems({ imageUrl: known.url, coverMediaId: known.id }, [known])
    expect(item?.state).toBe('needs-attention')
    expect(item?.issues).toContainEqual({ code: 'unsafe-url', severity: 'warning' })
  })

  it('attaches an asset id without replacing another image', () => {
    const html = '<p><img src="/first.jpg"><img src="/second.jpg"></p>'
    expect(setImageMediaId(html, '/second.jpg', 'media-2')).toBe(
      '<p><img src="/first.jpg"><img src="/second.jpg" data-media-id="media-2"></p>',
    )
  })

  it('replaces an existing media id deterministically', () => {
    expect(setImageMediaId('<p><img src="/x.jpg" data-media-id="old"></p>', '/x.jpg', 'new')).toContain(
      'data-media-id="new"',
    )
  })
})
