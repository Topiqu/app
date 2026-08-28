import { describe, expect, it } from 'vitest'

import { stripUntrustedIframes, youtubeEmbedUrl, youtubeVideoId } from '../../shared/utils/youtube'

describe('youtubeVideoId', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?t=10',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  ])('accepts a known YouTube shape: %s', (url) => {
    expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ')
  })

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'https://youtube.com/watch?v=short',
  ])('rejects an untrusted or malformed URL: %s', (url) => {
    expect(youtubeVideoId(url)).toBeNull()
  })

  it('renders only the privacy-enhanced embed origin', () => {
    expect(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('strips model-provided iframes before trusted slots are rendered', () => {
    expect(
      stripUntrustedIframes('<p>before</p><iframe src="https://evil.test/embed">fallback</iframe><p>after</p>'),
    ).toBe('<p>before</p><p>after</p>')
  })
})
