import { describe, expect, it } from 'vitest'

import { insightSchema } from '../../server/utils/ai/insight'
import { communityAverages, communityTrend, readCommunityInsight } from '../../server/utils/community'

const report = {
  summary: 'Readers are discussing the article constructively.',
  avgScore: 0,
  topEmotion: null,
  toxicity: 0,
  helpfulness: 0,
  sarcasm: 0,
  suggestion: null,
}

describe('community reporting contracts', () => {
  it('compares a real zero baseline and keeps an absent baseline distinct', () => {
    expect(communityTrend(0.4, 0)).toBe('up')
    expect(communityTrend(-0.4, 0)).toBe('down')
    expect(communityTrend(0.05, 0)).toBe('stable')
    expect(communityTrend(0.4)).toBeUndefined()
  })

  it('ignores malformed/non-finite sentiments and bounds points without losing diacritics', () => {
    const values = [
      { score: 0 },
      { score: 1, point: 'Příliš žluťoučký kůň', emotions: { joy: 1 } },
      { score: Number.NaN },
      { score: 2 },
      null,
    ]
    expect(communityAverages(values)).toMatchObject({
      count: 2,
      avgScore: 0.5,
      topEmotion: 'joy',
      topPoints: ['Příliš žluťoučký kůň'],
    })
    expect(
      communityAverages(Array.from({ length: 20 }, (_, index) => ({ score: 0, point: `Topic ${index}` }))).topPoints,
    ).toHaveLength(15)
  })

  it('reads a bounded legacy last-success chain and never exposes failure metadata', () => {
    const stored = { error: true, reason: 'private-provider-error', previous: { error: true, previous: report } }
    expect(readCommunityInsight(stored)).toMatchObject({ summary: report.summary, avgScore: 0 })
    expect(JSON.stringify(readCommunityInsight(stored))).not.toContain('private-provider-error')
    let excessive: unknown = report
    for (let depth = 0; depth < 20; depth++) excessive = { error: true, previous: excessive }
    expect(readCommunityInsight(excessive)).toBeNull()
    expect(readCommunityInsight('invalid JSON')).toBeNull()
  })

  it('uses the same 250-character summary contract for model output and stored views', () => {
    expect(insightSchema.safeParse({ ...report, summary: 'a'.repeat(251) }).success).toBe(false)
    expect(readCommunityInsight({ ...report, summary: 'a'.repeat(400) })?.summary).toHaveLength(250)
  })
})
