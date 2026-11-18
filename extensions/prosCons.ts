import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    prosCons: { insertProsCons: (labels: { pros: string; cons: string }) => ReturnType }
  }
}

/** One column: an editable label paragraph, then the list. The label is what exports and feeds show. */
export const ProsConsSide = Node.create({
  name: 'prosConsSide',
  content: 'paragraph bulletList',
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      side: {
        default: 'pros',
        parseHTML: (element) => (element.getAttribute('data-side') === 'cons' ? 'cons' : 'pros'),
        renderHTML: (attrs) => ({ 'data-side': attrs.side }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-side]', context: 'prosCons/' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0]
  },
})

const side = (side: 'pros' | 'cons', label: string) => ({
  type: 'prosConsSide',
  attrs: { side },
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: label }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
  ],
})

/** `<div data-type="pros-cons">` with a pros and a cons column, styled by `main.css`. */
export const ProsCons = Node.create({
  name: 'prosCons',
  group: 'block',
  content: 'prosConsSide prosConsSide',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="pros-cons"]' }]
  },
  renderHTML() {
    return ['div', { 'data-type': 'pros-cons' }, 0]
  },
  addCommands() {
    return {
      insertProsCons:
        ({ pros, cons }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, content: [side('pros', pros), side('cons', cons)] }),
    }
  },
})
