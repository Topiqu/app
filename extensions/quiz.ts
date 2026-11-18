import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import Quiz from './Quiz.vue'
import { normalizeQuizOptions } from '../shared/utils/polls'

const DEFAULT_QUESTION = 'Q1'

/** Same storage as `poll`; one option carries `correct: true` and `data-explanation` is shown after answering. */
export default Node.create({
  name: 'quiz',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      id: { default: null },
      pollId: { default: null },
      question: { default: DEFAULT_QUESTION },
      options: { default: [{ label: 'A1', correct: true }, { label: 'A2' }] },
      explanation: { default: '' },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="quiz"]',
        getAttrs: (elm) => {
          let raw: unknown = []
          try {
            raw = JSON.parse(elm.getAttribute('data-options') || '[]')
          } catch {
            // normalizeQuizOptions falls back to one default option.
          }
          return {
            id: elm.getAttribute('data-id') || null,
            pollId: elm.getAttribute('data-poll-id') || null,
            question: elm.getAttribute('data-question') || DEFAULT_QUESTION,
            options: normalizeQuizOptions(raw),
            explanation: elm.getAttribute('data-explanation') || '',
          }
        },
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, string> = {
      'data-type': 'quiz',
      'data-question': HTMLAttributes.question?.trim() || DEFAULT_QUESTION,
      'data-options': JSON.stringify(normalizeQuizOptions(HTMLAttributes.options)),
    }
    if (HTMLAttributes.id) attrs['data-id'] = HTMLAttributes.id
    if (HTMLAttributes.pollId) attrs['data-poll-id'] = HTMLAttributes.pollId
    const explanation = typeof HTMLAttributes.explanation === 'string' ? HTMLAttributes.explanation.trim() : ''
    if (explanation) attrs['data-explanation'] = explanation
    return ['div', attrs]
  },
  addNodeView() {
    return VueNodeViewRenderer(Quiz)
  },
})
