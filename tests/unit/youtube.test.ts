import { describe, expect, it } from 'vitest'

import {
  dropYoutubeLinkParagraphs,
  stripUntrustedIframes,
  youtubeEmbedUrl,
  youtubeVideoId,
} from '../../shared/utils/youtube'

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

describe('dropYoutubeLinkParagraphs', () => {
  it.each([
    '<p><a href="https://www.youtube.com/watch?v=88b9d5tWQoA">Video na YouTube</a></p>',
    '<p class="note"> <a target="_blank" href=\'https://youtu.be/dQw4w9WgXcQ?si=x&amp;t=3\'><strong>Watch</strong></a> </p>',
  ])('drops a paragraph that is only a YouTube link: %s', (paragraph) => {
    expect(dropYoutubeLinkParagraphs(`<p>a</p>${paragraph}<p>b</p>`)).toBe('<p>a</p><p>b</p>')
  })

  it.each([
    '<p>The <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">manufacturer demo</a> shows the defrost cycle.</p>',
    '<p><a href="https://example.com/watch?v=dQw4w9WgXcQ">Source</a></p>',
    '<p><a href="https://www.youtube.com/@channel">Channel</a></p>',
  ])('keeps a cited link and every non-video link: %s', (paragraph) => {
    expect(dropYoutubeLinkParagraphs(paragraph)).toBe(paragraph)
  })
})
