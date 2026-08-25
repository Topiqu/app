import { describe, expect, it } from 'vitest'

import { articleReadingProgress } from '../../app/composables/useArticleScrollContext'

describe('articleReadingProgress', () => {
  const viewportHeight = 800
  const contentTop = 1000
  const contentHeight = 4000

  const rectAt = (scrollTop: number) => ({ top: contentTop - scrollTop, height: contentHeight })

  it('tracks the article body instead of the full document height', () => {
    expect(articleReadingProgress(contentTop, viewportHeight, 0, rectAt(contentTop))).toBe(0)
    expect(articleReadingProgress(2600, viewportHeight, 0, rectAt(2600))).toBe(50)
    expect(articleReadingProgress(4200, viewportHeight, 0, rectAt(4200))).toBe(100)
  })

  it('clamps before and after the readable body', () => {
    expect(articleReadingProgress(0, viewportHeight, 0, rectAt(0))).toBe(0)
    expect(articleReadingProgress(5000, viewportHeight, 0, rectAt(5000))).toBe(100)
  })
})
