import { describe, expect, it } from 'vitest'

import { isKnowledgeStale, knowledgeAsOf, knowledgeQuota } from '../../shared/utils/knowledge'

describe('knowledge quotas and freshness', () => {
  it('gives BASIC and unknown plans no knowledge and scales with paid plans', () => {
    expect(knowledgeQuota('BASIC').maxSources).toBe(0)
    expect(knowledgeQuota(undefined).maxSources).toBe(0)
    expect(knowledgeQuota('PRO').maxSources).toBeLessThan(knowledgeQuota('PREMIUM').maxSources)
    expect(knowledgeQuota('PREMIUM').maxCharacters).toBeLessThan(knowledgeQuota('CUSTOM').maxCharacters)
  })

  it('prefers the explicit validity date, then the last fetch, then indexing', () => {
    const validAsOf = new Date('2025-01-01')
    const fetchedAt = new Date('2026-01-01')
    const indexedAt = new Date('2026-02-01')
    expect(knowledgeAsOf({ validAsOf, fetchedAt, indexedAt })).toBe(validAsOf)
    expect(knowledgeAsOf({ fetchedAt, indexedAt })).toBe(fetchedAt)
    expect(knowledgeAsOf({ indexedAt })).toBe(indexedAt)
    expect(knowledgeAsOf({})).toBeNull()
  })

  it('treats content older than twelve months as stale', () => {
    const now = new Date('2026-09-24')
    expect(isKnowledgeStale(new Date('2025-09-23'), now)).toBe(true)
    expect(isKnowledgeStale(new Date('2025-09-25'), now)).toBe(false)
    expect(isKnowledgeStale(null, now)).toBe(false)
  })
})
