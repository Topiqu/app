import { describe, expect, it } from 'vitest'

import { mediaSearchText, storageKeyFromMediaUrl } from '../../server/utils/mediaLibrary'
import { buildMediaRightsItems, extractArticleMedia } from '../../shared/utils/mediaRights'

describe('media library metadata', () => {
  it('builds deterministic searchable text from known metadata', () => {
    expect(
      mediaSearchText({
        name: 'Robot at Work',
        defaultAltText: 'A robot using a computer',
        originalFilename: 'robot.webp',
        author: 'Ada',
        license: 'CC BY',
        machineTags: ['Technology', 'Office'],
      }),
    ).toBe('robot at work a robot using a computer robot.webp ada cc by technology office')
  })

  it('only derives deletable keys from the configured CDN and safe prefixes', () => {
    const cdn = 'https://cdn.topiqu.test'
    expect(storageKeyFromMediaUrl(`${cdn}/uploads/photo.webp`, cdn)).toBe('uploads/photo.webp')
    expect(storageKeyFromMediaUrl(`${cdn}/article-images/ai.webp`, cdn)).toBe('article-images/ai.webp')
    expect(storageKeyFromMediaUrl(`${cdn}/branding/logo.webp`, cdn)).toBeNull()
    expect(storageKeyFromMediaUrl('https://other.test/uploads/photo.webp', cdn)).toBeNull()
  })

  it('extracts alt text for reusable body assets', () => {
    expect(extractArticleMedia({ content: '<p><img src="/robot.webp" alt="Robot u počítače"></p>' })[0]).toMatchObject({
      url: '/robot.webp',
      alt: 'Robot u počítače',
      placement: 'body',
    })
  })

  it('resolves legacy content by URL when it has no media id', () => {
    const [item] = buildMediaRightsItems({ content: '<p><img src="/robot.webp"></p>' }, [
      { id: 'asset', url: '/robot.webp', origin: 'TOPIQU_AI', attributionRequired: false },
    ])
    expect(item?.asset?.id).toBe('asset')
    expect(item?.state).toBe('recorded')
  })
})
