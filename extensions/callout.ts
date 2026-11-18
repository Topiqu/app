import { mergeAttributes, Node } from '@tiptap/core'
import { isCalloutTone, type CalloutTone } from '~~/shared/utils/articleEmbeds'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType
      setCalloutTone: (tone: CalloutTone) => ReturnType
      unsetCallout: () => ReturnType
    }
  }
}

/** `<aside data-type="callout" data-tone>`: styled by `main.css`, so exports keep it as a plain aside. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  // No headings, tables or nested boxes: a callout is a short aside, and a heading inside it would
  // join the article outline.
  content: '(paragraph | bulletList | orderedList)+',
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: 'note',
        parseHTML: (element) => {
          const tone = element.getAttribute('data-tone')
          return isCalloutTone(tone) ? tone : 'note'
        },
        renderHTML: (attrs) => ({ 'data-tone': attrs.tone }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes({ 'data-type': 'callout' }, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setCallout:
        (tone = 'note') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { tone }),
      setCalloutTone:
        (tone) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { tone }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    }
  },
})
