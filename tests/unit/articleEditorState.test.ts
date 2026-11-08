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

  it('treats TipTap empty markup as the untouched empty article body', () => {
    expect(articleEditorSnapshot({ ...article, content: '' }, [], null)).toBe(
      articleEditorSnapshot({ ...article, content: '<p></p>' }, [], null),
    )
  })

  it('ignores the blank source row inserted when the empty editor mounts', () => {
    expect(articleEditorSnapshot({ ...article, sources: [] }, [], null)).toBe(
      articleEditorSnapshot({ ...article, sources: ['', '   '] }, [], null),
    )
  })

  it.each([
    { field: 'answer', change: { answer: 'Restored direct answer.' } },
    { field: 'keyTakeaways', change: { keyTakeaways: ['Restored takeaway.'] } },
    { field: 'faq', change: { faq: [{ question: 'Restored question?', answer: 'Restored answer.' }] } },
    { field: 'format', change: { format: 'GUIDE' } },
    { field: 'structureVariant', change: { structureVariant: 'comparison' } },
    { field: 'prompt', change: { prompt: 'Restored article brief.' } },
  ])('detects a history restore that changes only $field', ({ change }) => {
    const baseline = articleEditorSnapshot(article, ['tag-a'], 'series-1')
    expect(articleEditorSnapshot({ ...article, ...change }, ['tag-a'], 'series-1')).not.toBe(baseline)
  })

  it('ignores summary whitespace and blank takeaway rows the save strips anyway', () => {
    const saved = { ...article, answer: 'Answer', keyTakeaways: ['First'] }
    expect(articleEditorSnapshot({ ...article, answer: ' Answer ', keyTakeaways: [' First', ''] }, [], null)).toBe(
      articleEditorSnapshot(saved, [], null),
    )
    expect(articleEditorSnapshot({ ...article, answer: '  ' }, [], null)).toBe(articleEditorSnapshot(article, [], null))
  })

  it('treats an empty FAQ as none and ignores its blank rows, but not a half-written entry', () => {
    const entry = { question: 'Kdy?', answer: 'Na jaře.' }
    const baseline = articleEditorSnapshot({ ...article, faq: [entry] }, [], null)
    expect(articleEditorSnapshot({ ...article, faq: [] }, [], null)).toBe(
      articleEditorSnapshot({ ...article, faq: null }, [], null),
    )
    expect(articleEditorSnapshot({ ...article, faq: [entry, { question: '', answer: '' }] }, [], null)).toBe(baseline)
    expect(articleEditorSnapshot({ ...article, faq: [entry, { question: 'Proč?', answer: '' }] }, [], null)).not.toBe(
      baseline,
    )
  })

  it('treats missing restored metadata like its empty persisted defaults', () => {
    expect(
      articleEditorSnapshot(
        {
          ...article,
          answer: null,
          keyTakeaways: [],
          faq: null,
          format: null,
          structureVariant: null,
          prompt: null,
        },
        [],
        null,
      ),
    ).toBe(articleEditorSnapshot(article, [], null))
  })
})
