import slugify from 'slugify'

export const ARTICLE_SLUG_MAX_LENGTH = 100

/** One rule for the editor and the API; the cut must not leave a trailing hyphen. */
export const articleSlug = (value: string) =>
  slugify(value, { lower: true, strict: true, trim: true })
    .slice(0, ARTICLE_SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
