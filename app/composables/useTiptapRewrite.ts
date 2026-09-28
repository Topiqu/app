import type { Editor } from '@tiptap/vue-3'

import { getHTMLFromFragment } from '@tiptap/core'
import { TEXT_EDIT_MAX_LENGTH, type TextEditAction } from '~~/shared/utils/aiEdit'

/** Only prose goes to the model; a selection spanning images, polls, videos or tables is refused. */
const TEXT_NODES = new Set(['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'text', 'hardBreak'])

export const useTiptapRewrite = (editor: Editor) => {
  const { t } = useI18n()
  const toast = useToast()
  const pending = shallowRef<TextEditAction | null>(null)

  const selectedPassage = () => {
    const { from, to, $from, $to } = editor.state.selection
    if (from === to) return null
    let prose = true
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (!TEXT_NODES.has(node.type.name)) prose = false
      return prose
    })
    if (!prose) return null
    const slice = editor.state.doc.slice(from, to)
    // Inside one paragraph send inline markup only, so the rewrite replaces words, not the block.
    const inline = $from.sameParent($to) && $from.parent.isTextblock
    const fragment = inline ? (slice.content.firstChild?.content ?? slice.content) : slice.content
    const html = getHTMLFromFragment(fragment, editor.schema)
    return html.length <= TEXT_EDIT_MAX_LENGTH ? { from, to, html, text: editor.state.doc.textBetween(from, to) } : null
  }

  const rewrite = async (action: TextEditAction) => {
    if (pending.value) return
    const passage = selectedPassage()
    if (!passage) return toast.add({ color: 'warning', title: t('articles.editor.aiEdit.unsupported') })
    pending.value = action
    try {
      const { html } = await $fetch<{ html: string }>('/api/articles/rewrite', {
        method: 'POST',
        body: { html: passage.html, action },
      })
      // The author may have kept typing while the model worked; never overwrite a changed range.
      if (editor.state.doc.textBetween(passage.from, passage.to) !== passage.text)
        return toast.add({ color: 'warning', title: t('articles.editor.aiEdit.changed') })
      editor.chain().focus().insertContentAt({ from: passage.from, to: passage.to }, html).run()
    } catch (error) {
      toast.add({ color: 'error', title: fetchErrorMessage(error, t('articles.editor.aiEdit.failed')) })
    } finally {
      pending.value = null
    }
  }

  return { pending, rewrite }
}
