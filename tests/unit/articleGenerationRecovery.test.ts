import { describe, expect, it } from 'vitest'

import { hasUsefulGenerationSnapshot } from '../../server/utils/articleGenerationRecovery'

describe('article generation recovery', () => {
  it('charges only snapshots that give the author a recoverable result', () => {
    expect(hasUsefulGenerationSnapshot({})).toBe(false)
    expect(hasUsefulGenerationSnapshot({ content: '<p> </p>' })).toBe(false)
    expect(hasUsefulGenerationSnapshot({ sources: ['https://example.com/source'] })).toBe(true)
    expect(hasUsefulGenerationSnapshot({ content: '<p>Usable partial article</p>' })).toBe(true)
  })
})
