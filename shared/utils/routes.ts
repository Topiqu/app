import type { Language } from '~~/generated/zenstack/models'

/**
 * Mirrors `i18n.pages` in `nuxt.config.ts` — Nitro has no `localePath`, and the sitemap, feed and
 * LLM surfaces all build URLs outside the Vue app. `tests/unit/routes.test.ts` guards the drift.
 */
export const LOCALIZED_SEGMENTS = {
  article: { cs: 'clanky', en: 'articles', de: 'artikel', fr: 'articles' },
  tag: { cs: 'stitky', en: 'tags', de: 'schlagwoerter', fr: 'etiquettes' },
  author: { cs: 'autor', en: 'author', de: 'autor', fr: 'auteur' },
} as const satisfies Record<string, Record<Language, string>>

export const AUTH_SEGMENTS = {
  cs: 'autorizace',
  en: 'auth',
  de: 'anmeldung',
  fr: 'connexion',
} as const satisfies Record<Language, string>

const path = (kind: keyof typeof LOCALIZED_SEGMENTS, language: Language, value: string) =>
  `/${language}/${LOCALIZED_SEGMENTS[kind][language]}/${encodeURIComponent(value)}`

export const articlePath = (language: Language, slug: string) => path('article', language, slug)

/** Inverse of `articlePath`; query, hash and one trailing slash are ignored. */
export const parseArticlePath = (pathname: string): { language: Language; slug: string } | null => {
  const [empty, language, segment, slug, ...rest] = pathname.split(/[?#]/)[0]!.split('/')
  if (empty !== '' || !slug || rest.some(Boolean)) return null
  if (!Object.hasOwn(LOCALIZED_SEGMENTS.article, language!)) return null
  if (LOCALIZED_SEGMENTS.article[language as Language] !== segment) return null
  try {
    return { language: language as Language, slug: decodeURIComponent(slug) }
  } catch {
    return null
  }
}
export const tagPath = (language: Language, slug: string) => path('tag', language, slug)
export const authorPath = (language: Language, name: string) => path('author', language, name)
/** `strategy: 'prefix'` — even the default locale carries its prefix, so there is no bare `/`. */
export const homePath = (language: Language) => `/${language}`
export const authPath = (language: Language) => `/${language}/${AUTH_SEGMENTS[language]}`

/**
 * Markdown variant of an article. Prefixed rather than a bare `<url>.md` because Nitro's file
 * router cannot bind a param that owns only part of a segment, and a top-level catch-all would
 * swallow every page route. The handler accepts the path with or without the suffix.
 */
export const markdownPath = (language: Language, slug: string) => `/md${articlePath(language, slug)}.md`
