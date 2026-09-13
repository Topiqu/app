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

/** A catalogue hit without evidence for the requested subject is not usable. */
export const matchesImageQuery = (description: string | undefined, query: string) => {
  const required = words(query).filter((word) => !descriptiveWords.has(word))
  const actual = new Set(words(description ?? ''))
  const requested = new Set(words(query))
  for (const depiction of ['cosplay', 'cosplayer', 'fanart', 'figurine', 'statue', 'replica', 'keychain', 'pendant']) {
    if (actual.has(depiction) && !requested.has(depiction)) return false
  }
  if (/\bfan\s+art\b/i.test(description ?? '') && !/\bfan\s+art\b/i.test(query)) return false
  return required.length > 0 && required.every((word) => actual.has(word))
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
