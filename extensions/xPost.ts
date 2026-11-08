import type { DOMOutputSpec } from '@tiptap/pm/model'

import { Node } from '@tiptap/core'

type XPostAttrs = { url: string; author: string; handle: string; text: string; media: boolean }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    xPost: { insertXPost: (attrs: XPostAttrs) => ReturnType }
  }
}

const HANDLE = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\//

const textLines = (text: string): DOMOutputSpec[] =>
  text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((part): DOMOutputSpec => [
      'p',
      ...part.split('\n').flatMap((line, index) => (index ? [['br'], line] : [line])),
    ])

/** Mirrors `xPostHtml`; the parse rule outranks the plain blockquote so the post keeps its data. */
export const XPost = Node.create({
  name: 'xPost',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      url: { default: null },
      author: { default: '' },
      text: { default: '' },
      media: { default: false },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'blockquote[data-type="x-post"]',
        priority: 60,
        getAttrs: (element) => {
          const url = element.getAttribute('data-url')
          if (!url) return false
          return {
            url,
            author: element.getAttribute('data-author') || '',
            text: element.getAttribute('data-text') || '',
            media: element.getAttribute('data-media') === 'true',
          }
        },
      },
    ]
  },
  renderHTML({ node }) {
    const { url, author, text, media } = node.attrs as XPostAttrs
    const handle = url.match(HANDLE)?.[1] ?? ''
    return [
      'blockquote',
      {
        'data-type': 'x-post',
        'data-url': url,
        'data-author': author,
        ...(media ? { 'data-media': 'true' } : {}),
        'data-text': text,
      },
      ...textLines(text),
      ['p', '— ', ['a', { href: url }, `${author} (@${handle})`]],
    ]
  },
  addCommands() {
    return {
      insertXPost:
        ({ url, author, text, media }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { url, author, text, media } }),
    }
  },
})
