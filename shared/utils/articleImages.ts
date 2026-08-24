const attribute = (name: string) => new RegExp(`\\s${name}\\s*=`, 'i')

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** Adds loading hints without making the published body depend on the runtime image proxy. */
export const optimizeArticleImages = (html: string) =>
  html.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)
    if (!source?.[2]) return tag

    const src = source[2].replace(/&amp;/g, '&')
    let optimized = tag

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
