import { Mark } from '@tiptap/core'

/** Keeps the AI label a `<span data-ai-disclosure>` through an edit, so a tenant can still hide it. */
export const AiDisclosure = Mark.create({
  name: 'aiDisclosure',
  inclusive: false,
  parseHTML: () => [{ tag: 'span[data-ai-disclosure]' }],
  renderHTML: () => ['span', { 'data-ai-disclosure': '' }, 0],
})
