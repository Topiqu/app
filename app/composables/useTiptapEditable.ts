import type { Editor } from '@tiptap/core'

/** `editor.isEditable` is not reactive, and `setEditable` emits `update` without a transaction. */
export function useTiptapEditable(editor: Editor) {
  const editable = shallowRef(editor.isEditable)
  const sync = () => (editable.value = editor.isEditable)
  editor.on('update', sync)
  onBeforeUnmount(() => editor.off('update', sync))
  return editable
}
