import { describe, expect, it } from 'vitest'

import { articleEditorSnapshot } from '../../app/utils/articleEditorState'

const article = {
  title: 'Fresh article',
  excerpt: 'Short summary',
  content: '<p>Body</p>',
  slug: 'fresh-article',
  imageUrl: '/cover.webp',
  status: 'published',
  releaseAt: null,
  sources: ['https://example.com'],
  savedAmount: 0,
  savedTimeMinutes: 0,
  aiInvolvement: 'NONE',
}

describe('articleEditorSnapshot', () => {
  it('ignores API-derived fields that the editor does not persist', () => {
    const baseline = articleEditorSnapshot(article, ['tag-b', 'tag-a'], 'series-1')
    const refreshed = articleEditorSnapshot(
      { ...article, views: 42, likedByUser: true } as typeof article,
      ['tag-a', 'tag-b'],
      'series-1',
    )

    expect(refreshed).toBe(baseline)
  })

  it('detects changes to editable article fields, tags and series', () => {
    const baseline = articleEditorSnapshot(article, ['tag-a'], 'series-1')

    expect(articleEditorSnapshot({ ...article, excerpt: 'Changed' }, ['tag-a'], 'series-1')).not.toBe(baseline)
    expect(articleEditorSnapshot(article, ['tag-b'], 'series-1')).not.toBe(baseline)
    expect(articleEditorSnapshot(article, ['tag-a'], 'series-2')).not.toBe(baseline)
  })
})
