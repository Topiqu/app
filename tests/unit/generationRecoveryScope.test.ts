import { describe, expect, it } from 'vitest'

import { generationRecoveryMatchesArticle } from '../../shared/utils/generationRecoveryScope'

describe('generation recovery scope', () => {
  it('keeps an existing article run attached to that article', () => {
    expect(generationRecoveryMatchesArticle({ sourceArticleId: 'a' }, 'a')).toBe(true)
    expect(generationRecoveryMatchesArticle({ sourceArticleId: 'a' }, 'b')).toBe(false)
    expect(generationRecoveryMatchesArticle({ sourceArticleId: 'a' }, 'new')).toBe(false)
  })

  it('treats legacy runs without a source article as new-article runs', () => {
    expect(generationRecoveryMatchesArticle({}, 'new')).toBe(true)
    expect(generationRecoveryMatchesArticle(null, 'new')).toBe(true)
    expect(generationRecoveryMatchesArticle({ sourceArticleId: null }, 'new')).toBe(true)
    expect(generationRecoveryMatchesArticle({}, 'a')).toBe(false)
  })
})
