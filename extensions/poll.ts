import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import Poll from './Poll.vue'
import { normalizePollOptions } from '../shared/utils/polls'

export default Node.create({
  name: 'poll',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      id: { default: null },
      pollId: { default: null },
      question: { default: 'Q1' },
      options: { default: [{ label: 'A1' }] },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="poll"]',
        getAttrs: (elm) => {
          let options
          try {
            options = normalizePollOptions(JSON.parse(elm.getAttribute('data-options') || '[]'))
          } catch {
            options = [{ label: 'A1' }]
          }
          return {
            id: elm.getAttribute('data-id') || null,
            pollId: elm.getAttribute('data-poll-id') || null,
            question: elm.getAttribute('data-question') || 'Q1',
            options: options.length ? options : [{ label: 'A1' }],
          }
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const options = normalizePollOptions(HTMLAttributes.options)
    const attrs: Record<string, string> = {
      'data-type': 'poll',
      'data-question': HTMLAttributes.question?.trim() || 'Q1',
      'data-options': JSON.stringify(options.length ? options : [{ label: 'A1' }]),
    }
    if (HTMLAttributes.id) attrs['data-id'] = HTMLAttributes.id
    if (HTMLAttributes.pollId) attrs['data-poll-id'] = HTMLAttributes.pollId
    return ['div', attrs]
  },
  addNodeView() {
    return VueNodeViewRenderer(Poll)
  },
})
