import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

const { window } = new JSDOM('')
const DOMPurify = createDOMPurify(window as unknown as typeof globalThis)

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.nodeName === 'IFRAME' && data.attrName === 'src') {
    const allowed = /^https?:\/\/(?:www\.)?(youtube\.com|youtu\.be)\//.test(data.attrValue)
    if (!allowed) data.keepAttr = false
  }
})

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
