import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { insightSchema } from '../../server/utils/ai/insight'
import { COMMUNITY_EMOTIONS, communityEmotion } from '../../shared/utils/communityInsight'

describe('community emotion labels', () => {
  it('recognizes stored emotion identifiers, including curiosity', () => {
    expect(communityEmotion('curiosity')).toBe('curiosity')
    expect(communityEmotion(' Curiosity ')).toBe('curiosity')
    for (const emotion of COMMUNITY_EMOTIONS) expect(communityEmotion(emotion)).toBe(emotion)
    for (const value of [null, undefined, {}, '', 'unrecognized_emotion']) expect(communityEmotion(value)).toBeNull()
  })

  it.each(['cs', 'en', 'de', 'fr'])('translates every canonical emotion into %s', (locale) => {
    const { stats } = JSON.parse(readFileSync(`i18n/locales/${locale}/stats.json`, 'utf8'))
    for (const emotion of COMMUNITY_EMOTIONS) expect(stats.sentiment.emotions[emotion]).toBeTruthy()
    if (locale === 'cs') expect(stats.sentiment.emotions.curiosity).toBe('Zvědavost')
  })

  it('constrains generated emotion labels to the translated vocabulary', () => {
    const emotion = insightSchema.shape.topEmotion
    expect(emotion.parse('curiosity')).toBe('curiosity')
    expect(emotion.parse(null)).toBeNull()
    expect(emotion.safeParse('unrecognized_emotion').success).toBe(false)
  })
})
