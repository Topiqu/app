export const nextTranslationVersion = (previous?: Date | null) =>
  new Date(Math.max(Date.now(), (previous?.getTime() ?? 0) + 1))

export const translationSelect = {
  id: true,
  language: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  answer: true,
  keyTakeaways: true,
  faq: true,
  status: true,
  source: true,
  error: true,
  translatedAt: true,
  updatedAt: true,
} as const
