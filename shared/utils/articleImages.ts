const attribute = (name: string) => new RegExp(`\\s${name}\\s*=`, 'i')

const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

/** Adds responsive IPX URLs and stable dimensions to images stored inside published HTML. */
export const optimizeArticleImages = (html: string, resolve: (src: string, width: number) => string) =>
  html.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i)
    if (!source?.[2]) return tag

    const src = source[2].replace(/&amp;/g, '&')
    const small = escapeAttribute(resolve(src, 640))
    const large = escapeAttribute(resolve(src, 1000))
    let optimized = tag.replace(source[0], ` src="${large}"`)

    const attrs: Record<string, string> = {
      srcset: `${small} 640w, ${large} 1000w`,
      sizes: '(max-width: 640px) calc(100vw - 3rem), 936px',
      width: '1000',
      height: '667',
      loading: 'lazy',
      decoding: 'async',
    }

    for (const [name, value] of Object.entries(attrs)) {
      if (!attribute(name).test(optimized)) optimized = optimized.replace(/\s*\/?>$/, ` ${name}="${value}">`)
    }

    return optimized
  })
