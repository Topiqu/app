import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

const { window } = new JSDOM('')
const DOMPurify = createDOMPurify(window as unknown as typeof globalThis)

export const sanitizeHtml = (dirty: string) => {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
  })
}
