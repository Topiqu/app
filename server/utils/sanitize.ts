import DOMPurify from 'isomorphic-dompurify'

/**
 * Text into HTML. Quotes are escaped too, so the result is safe inside an attribute value.
 * The counterpart to `sanitizeHtml`: that one keeps markup and removes what is dangerous, this
 * one denies markup outright — for values that are text and must never become elements.
 */
export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const sanitizeHtml = (dirty: string) => {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: [
      'allowfullscreen',
      'class',
      'src',
      'width',
      'height',
      'cclanguage',
      'disablekbcontrols',
      'enableiframeapi',
      'endtime',
      'ivloadpolicy',
      'loop',
      'modestbranding',
      'origin',
      'playlist',
      'rel',
      'start',
      'data-youtube-video',
      'alt',
      'title',
      'colwidth',
    ],
  })
}
