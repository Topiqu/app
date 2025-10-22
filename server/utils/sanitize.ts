import DOMPurify from 'isomorphic-dompurify'

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
    ],
  })
}
