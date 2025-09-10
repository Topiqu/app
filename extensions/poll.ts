import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import Poll from './Poll.vue'

export default Node.create({
  name: 'poll',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: crypto.randomUUID() },
      question: { default: 'Q1' },
      options: { default: ['A1'] },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="poll"]',
        getAttrs: (elm) => {
          let options
          try {
            options = JSON.parse(elm.getAttribute('data-options') || '[]')
          } catch {
            options = ['A1']
          }
          return {
            id: elm.getAttribute('data-id') || crypto.randomUUID(),
            question: elm.getAttribute('data-question') || 'Q1',
            options: options.length ? options : ['A1'],
          }
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const options = HTMLAttributes.options?.length ? HTMLAttributes.options : ['A1']
    return [
      'div',
      {
        'data-type': 'poll',
        'data-id': HTMLAttributes.id || crypto.randomUUID(),
        'data-question': HTMLAttributes.question?.trim() || 'Q1',
        'data-options': JSON.stringify(options),
      },
    ]
  },
  addNodeView() {
    return VueNodeViewRenderer(Poll)
  },
})
