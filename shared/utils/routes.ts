import type { Language } from '@prisma/client'

/**
 * Mirrors `i18n.pages` in `nuxt.config.ts` — Nitro has no `localePath`, and the sitemap, feed and
 * LLM surfaces all build URLs outside the Vue app. `tests/unit/routes.spec.ts` guards the drift.
 */
export const LOCALIZED_SEGMENTS = {
  article: { cs: 'clanky', en: 'articles' },
  tag: { cs: 'stitky', en: 'tags' },
  author: { cs: 'autor', en: 'author' },
} as const satisfies Record<string, Record<Language, string>>

const path = (kind: keyof typeof LOCALIZED_SEGMENTS, language: Language, value: string) =>
  `/${language}/${LOCALIZED_SEGMENTS[kind][language]}/${encodeURIComponent(value)}`

export const articlePath = (language: Language, slug: string) => path('article', language, slug)
export const tagPath = (language: Language, slug: string) => path('tag', language, slug)
export const authorPath = (language: Language, name: string) => path('author', language, name)

/** `strategy: 'prefix'` — even the default locale carries its prefix, so there is no bare `/`. */
export const homePath = (language: Language) => `/${language}`

/**
 * Markdown variant of an article. Prefixed rather than a bare `<url>.md` because Nitro's file
 * router cannot bind a param that owns only part of a segment, and a top-level catch-all would
 * swallow every page route. The handler accepts the path with or without the suffix.
 */
export const markdownPath = (language: Language, slug: string) => `/md${articlePath(language, slug)}.md`
