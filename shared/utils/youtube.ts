const VIDEO_ID = /^[\w-]{11}$/

/** Accepts only known YouTube URL shapes and returns the inert video id used by our own renderer. */
export const youtubeVideoId = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let id: string | null = null

    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? null
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v')
      else if (/^\/(embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] ?? null
    }

    return id && VIDEO_ID.test(id) ? id : null
  } catch {
    return null
  }
}

export const youtubeEmbedUrl = (raw: string) => {
  const id = youtubeVideoId(raw)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
}

/** AI body HTML never owns an iframe; verified video slots are rendered server-side afterwards. */
export const stripUntrustedIframes = (html: string) =>
  html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '').replace(/<iframe\b[^>]*\/?\s*>/gi, '')
