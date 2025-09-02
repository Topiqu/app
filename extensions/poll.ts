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
      question: { default: '' },
      options: { default: [] },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="poll"]',
        getAttrs: (elm) => ({
          id: elm.getAttribute('data-id') || crypto.randomUUID(),
          question: elm.getAttribute('data-question') || '',
          options: JSON.parse(elm.getAttribute('data-options') || '[]'),
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
        'data-question': HTMLAttributes.question || '',
        'data-options': JSON.stringify(HTMLAttributes.options || []),
      },
      '',
    ]
  },
  addNodeView() {
    return VueNodeViewRenderer(Poll)
  },
})
