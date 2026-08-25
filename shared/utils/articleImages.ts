const attribute = (name: string) => new RegExp(`\\s${name}\\s*=`, 'i')

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

export type ArticleImageTransformer = (source: string, width: number) => string | null

const RESPONSIVE_WIDTHS = [480, 768, 1024] as const
const ARTICLE_IMAGE_SIZES = '(min-width: 768px) 68ch, calc(100vw - 2rem)'

/** Adds responsive variants while retaining the upload as a direct fallback. */
export const optimizeArticleImages = (html: string, transform?: ArticleImageTransformer) =>
  html.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)
    if (!source?.[2]) return tag

    const src = source[2].replace(/&amp;/g, '&')
    let optimized = tag

    if (transform && !attribute('srcset').test(optimized)) {
      const variants = RESPONSIVE_WIDTHS.map((width) => {
        const url = transform(src, width)
        return url ? `${escapeAttribute(url)} ${width}w` : null
      }).filter((variant): variant is string => Boolean(variant))

      if (variants.length) {
        const defaultSource = transform(src, 1024)
        if (defaultSource) optimized = optimized.replace(source[0], ` src="${escapeAttribute(defaultSource)}"`)
        optimized = optimized.replace(/\s*\/?>$/, ` srcset="${variants.join(', ')}">`)
        if (!attribute('sizes').test(optimized))
          optimized = optimized.replace(/\s*\/?>$/, ` sizes="${ARTICLE_IMAGE_SIZES}">`)
      }
    }

    const attrs: Record<string, string> = {
      'data-original-src': escapeAttribute(src),
      loading: 'lazy',
      decoding: 'async',
    }

    for (const [name, value] of Object.entries(attrs)) {
      if (!attribute(name).test(optimized)) optimized = optimized.replace(/\s*\/?>$/, ` ${name}="${value}">`)
    }

    return optimized
  })
