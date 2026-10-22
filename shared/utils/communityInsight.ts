export const COMMUNITY_EMOTIONS = ['joy', 'anger', 'sadness', 'fear', 'surprise', 'curiosity'] as const
export type CommunityEmotion = (typeof COMMUNITY_EMOTIONS)[number]

export const communityEmotion = (value: unknown): CommunityEmotion | null => {
  if (typeof value !== 'string') return null
  const emotion = value.trim().toLowerCase()
  return COMMUNITY_EMOTIONS.find((candidate) => candidate === emotion) ?? null
}
