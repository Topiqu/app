import type { ShallowRef } from 'vue'
import type { Editor } from '@tiptap/vue-3'

import { getHTMLFromFragment } from '@tiptap/core'
import {
  DOCUMENT_EDIT_MAX_BLOCKS,
  DOCUMENT_EDIT_MAX_LENGTH,
  TEXT_EDIT_INSTRUCTION_MAX_LENGTH,
  TEXT_EDIT_MAX_LENGTH,
  type TextEditAction,
} from '~~/shared/utils/aiEdit'

/** Only prose goes to the model; a selection spanning images, polls, videos or tables is refused. */
const TEXT_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'text',
  'hardBreak',
])
const pendingByEditor = new WeakMap<Editor, ShallowRef<TextEditAction | 'document' | null>>()

export interface SelectedTextPassage {
  from: number
  to: number
  html: string
  text: string
  snapshot: Editor['state']['doc']
}

export const selectedTextPassage = (editor: Editor): SelectedTextPassage | null => {
  const { from, to } = editor.state.selection
  if (from === to) return null
  let prose = true
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!TEXT_NODES.has(node.type.name)) prose = false
    return prose
  })
  if (!prose) return null
  const slice = editor.state.doc.slice(from, to)
  // Inside one paragraph send inline markup only, so the rewrite replaces words, not the block.
  // ProseMirror already omits the shared paragraph wrapper from an inline slice.
  const html = getHTMLFromFragment(slice.content, editor.schema)
  return html.length <= TEXT_EDIT_MAX_LENGTH
    ? { from, to, html, text: editor.state.doc.textBetween(from, to), snapshot: editor.state.doc }
    : null
}

/** Text runs are kept in their existing blocks; embedded media and table structure stay untouched. */
export const documentTextPassages = (editor: Editor) => {
  const passages: { from: number; to: number; html: string }[] = []
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return true
    let start = 0
    let end = 0
    const addRun = () => {
      const fragment = node.content.cut(start, end)
      if (fragment.textBetween(0, fragment.size).trim())
        passages.push({
          from: position + 1 + start,
          to: position + 1 + end,
          html: getHTMLFromFragment(fragment, editor.schema),
        })
    }
    node.content.forEach((child, offset) => {
      if (child.type.name === 'text' || child.type.name === 'hardBreak') {
        end = offset + child.nodeSize
      } else {
        addRun()
        start = offset + child.nodeSize
        end = start
      }
    })
    addRun()
    return false
  })
  return passages
}

export const applyDocumentTextPassages = (
  editor: Editor,
  passages: ReturnType<typeof documentTextPassages>,
  blocks: string[],
) => {
  if (blocks.length !== passages.length) throw new Error('The rewritten article has a different number of blocks.')
  const chain = editor.chain().focus()
  for (let index = passages.length - 1; index >= 0; index--) {
    const passage = passages[index]!
    chain.insertContentAt({ from: passage.from, to: passage.to }, blocks[index]!)
  }
  if (!chain.run()) throw new Error('The rewritten article could not be inserted.')
}

export const useTiptapRewrite = (editor: Editor) => {
  const { t } = useI18n()
  const toast = useToast()
  const pending = pendingByEditor.get(editor) ?? shallowRef<TextEditAction | 'document' | null>(null)
  pendingByEditor.set(editor, pending)

  const captureSelection = () => selectedTextPassage(editor)

  const rewrite = async (action: TextEditAction, instruction?: string, captured?: SelectedTextPassage) => {
    if (pending.value) return false
    const passage = captured ?? captureSelection()
    if (!passage) {
      toast.add({ color: 'warning', title: t('articles.editor.aiEdit.unsupported') })
      return false
    }
    const request = instruction?.trim()
    if (action === 'improve' && (!request || request.length > TEXT_EDIT_INSTRUCTION_MAX_LENGTH)) return false
    pending.value = action
    try {
      const { html } = await $fetch<{ html: string }>('/api/articles/rewrite', {
        method: 'POST',
        body: { html: passage.html, action, ...(request ? { instruction: request } : {}) },
      })
      // The author may have kept typing while the model worked; never overwrite a changed range.
      if (!passage.snapshot.eq(editor.state.doc)) {
        toast.add({ color: 'warning', title: t('articles.editor.aiEdit.changed') })
        return false
      }
      editor.chain().focus().insertContentAt({ from: passage.from, to: passage.to }, html).run()
      return true
    } catch (error) {
      toast.add({ color: 'error', title: fetchErrorMessage(error, t('articles.editor.aiEdit.failed')) })
      return false
    } finally {
      pending.value = null
    }
  }

  const rewriteAll = async (instruction: string) => {
    if (pending.value) return false
    const request = instruction.trim()
    if (!request || request.length > TEXT_EDIT_INSTRUCTION_MAX_LENGTH) return false
    const snapshot = editor.state.doc
    const passages = documentTextPassages(editor)
    const totalLength = passages.reduce((sum, passage) => sum + passage.html.length, 0)
    if (!passages.length) {
      toast.add({ color: 'warning', title: t('articles.editor.aiEdit.unsupported') })
      return false
    }
    if (
      passages.length > DOCUMENT_EDIT_MAX_BLOCKS ||
      totalLength > DOCUMENT_EDIT_MAX_LENGTH ||
      passages.some((passage) => passage.html.length > TEXT_EDIT_MAX_LENGTH)
    ) {
      toast.add({ color: 'warning', title: t('articles.editor.aiEdit.tooLong') })
      return false
    }

    pending.value = 'document'
    try {
      const { blocks } = await $fetch<{ blocks: string[] }>('/api/articles/rewrite', {
        method: 'POST',
        body: { blocks: passages.map((passage) => passage.html), action: 'improve', instruction: request },
      })
      if (!snapshot.eq(editor.state.doc)) {
        toast.add({ color: 'warning', title: t('articles.editor.aiEdit.changed') })
        return false
      }
      applyDocumentTextPassages(editor, passages, blocks)
      return true
    } catch (error) {
      toast.add({ color: 'error', title: fetchErrorMessage(error, t('articles.editor.aiEdit.failed')) })
      return false
    } finally {
      pending.value = null
    }
  }

  return { pending, captureSelection, rewrite, rewriteAll }
}
