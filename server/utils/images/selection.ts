import type { ArticleImage } from './types'

const words = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? []
const descriptiveWords = new Set([
  'the',
  'a',
  'an',
  'of',
  'in',
  'at',
  'and',
  'with',
  'photo',
  'photograph',
  'image',
  'screenshot',
  'official',
])

/** Names and installment numbers identify the subject; years and lowercase scene words only describe
 * it. A leading capital counts only when the next token continues the name ("Andrej Babis",
 * "PlayStation 5"), so a sentence-case query like "Office meeting" names nothing. */
const identityWords = (query: string) => {
  const tokens = query.match(/[\p{L}\p{N}]+/gu) ?? []
  return tokens.flatMap((token, index) => {
    const next = tokens[index + 1]
    const capitalized = /^\p{Lu}/u.test(token)
    const number = /^\d{1,3}$/.test(token)
    const continues = !!next && (/^\p{Lu}/u.test(next) || /^\d{1,3}$/.test(next))
    return number || (capitalized && (index > 0 || continues)) ? words(token) : []
  }).filter((word) => !descriptiveWords.has(word))
}

/** A catalogue hit without evidence for the requested subject is not usable. Requiring every
 * descriptive word as well rejected nearly every real photo and pushed articles onto AI images. */
export const matchesImageQuery = (description: string | undefined, query: string) => {
  const actual = new Set(words(description ?? ''))
  const requested = new Set(words(query))
  for (const depiction of ['cosplay', 'cosplayer', 'fanart', 'figurine', 'statue', 'replica', 'keychain', 'pendant']) {
    if (actual.has(depiction) && !requested.has(depiction)) return false
  }
  if (/\bfan\s+art\b/i.test(description ?? '') && !/\bfan\s+art\b/i.test(query)) return false
  const identity = identityWords(query)
  if (identity.length) return identity.every((word) => actual.has(word))
  const content = [...requested].filter((word) => !descriptiveWords.has(word) && !/^\d+$/.test(word))
  const overlap = content.filter((word) => actual.has(word)).length
  return content.length > 0 && overlap >= Math.ceil(content.length / 2)
}

/** When an event-specific search misses, an identifiable subject can still supply a labelled
 * illustrative photo. Keep installment numbers: a photo of another game is not a fallback. */
export const photoSubjectQuery = (query: string): string | null => {
  const terms = query.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) ?? []
  if (terms.length <= 2 || terms.some((term) => /^\d{1,2}$/.test(term))) return null
  const [first, second] = terms
  if (!first || !second || !/^\p{Lu}[\p{L}'’-]+$/u.test(first) || !/^\p{Lu}[\p{L}'’-]+$/u.test(second)) return null
  if (new Set(['the', 'czech', 'president', 'prime', 'minister', 'official']).has(first.toLowerCase())) return null
  return `${first} ${second}`
}

const canonicalImageUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (url.hostname === 'press.cdn.cdpr.app') url.pathname = url.pathname.replace(/_q\d+_\d+x\d+(?=\.)/, '')
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|w|h|width|height|quality|q|format|fm)$/i.test(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return url.toString()
  } catch {
    return value
  }
}

/** Reserve synchronously before emitting concurrent image results. */
export const createImageSelection = () => {
  const used = new Set<string>()
  return (image: Pick<ArticleImage, 'url' | 'credit'>) => {
    const keys = [image.url, image.credit?.sourceUrl].filter((url): url is string => !!url).map(canonicalImageUrl)
    if (keys.some((key) => used.has(key))) return false
    keys.forEach((key) => used.add(key))
    return true
  }
}
