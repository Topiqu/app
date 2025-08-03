import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

const { window } = new JSDOM('')
const DOMPurify = createDOMPurify(window as unknown as typeof globalThis)

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
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:https?):)?\/\/)(?:www\.)?(?:youtube\.com|youtu\.be)\/.+$/,
  })
}
