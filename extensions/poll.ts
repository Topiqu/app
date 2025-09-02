import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import Poll from './Poll.vue'

export default Node.create({
  name: 'poll',
  group: 'block',
  content: 'text*',
  draggable: false,
  addAttributes() {
    return {
      id: { default: crypto.randomUUID() },
      question: { default: 'Zadej otázku' },
      options: { default: ['Možnost 1'] },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="poll"]',
        getAttrs: (elm) => ({
          id: elm.getAttribute('data-id') || crypto.randomUUID(),
          question: elm.getAttribute('data-question') || 'Zadej otázku',
          options: JSON.parse(elm.getAttribute('data-options') || '[]')?.length
            ? JSON.parse(elm.getAttribute('data-options'))
            : ['Možnost 1'],
        }),
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      {
        'data-type': 'poll',
        'data-id': HTMLAttributes.id || crypto.randomUUID(),
        'data-question': HTMLAttributes.question || 'Zadej otázku',
        'data-options': JSON.stringify(HTMLAttributes.options?.length ? HTMLAttributes.options : ['Možnost 1']),
      },
      '',
    ]
  },
  addNodeView() {
    return VueNodeViewRenderer(Poll)
  },
})
