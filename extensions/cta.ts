import type { DOMOutputSpec } from '@tiptap/pm/model'

import { Node } from '@tiptap/core'

import type { ArticleCtaData } from '../shared/utils/articleEmbeds'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cta: { insertCta: (attrs: ArticleCtaData) => ReturnType }
  }
}

/** Mirrors `ctaHtml`: the fields are attributes, the inner paragraphs are the fallback. */
export const Cta = Node.create({
  name: 'cta',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: '' },
      text: { default: '' },
      label: { default: '' },
      url: { default: '' },
      tone: { default: 'accent' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="cta"]',
        getAttrs: (element) => ({
          title: element.getAttribute('data-title') || '',
          text: element.getAttribute('data-text') || '',
          label: element.getAttribute('data-label') || '',
          url: element.getAttribute('data-url') || '',
          tone: element.getAttribute('data-tone') === 'info' ? 'info' : 'accent',
        }),
      },
    ]
  },
  renderHTML({ node }) {
    const { title, text, label, url, tone } = node.attrs as ArticleCtaData
    const body: DOMOutputSpec[] = [['p', ['strong', title]]]
    if (text) body.push(['p', text])
    body.push(['p', ['a', { href: url }, label]])
    return [
      'div',
      {
        'data-type': 'cta',
        'data-tone': tone,
        'data-title': title,
        'data-text': text,
        'data-label': label,
        'data-url': url,
      },
      ...body,
    ]
  },
  addCommands() {
    return {
      insertCta:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})
