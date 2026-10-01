<template>
  <EditorContent
    :editor="editor"
    class="prompt-input w-full rounded-md bg-default text-sm text-highlighted ring ring-inset ring-accented focus-within:ring-2 focus-within:ring-primary"
    :class="{ 'opacity-75': disabled }"
  />
</template>

<script setup lang="ts">
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { useFormField } from '@nuxt/ui/composables/useFormField'

const props = defineProps<{ label: string; placeholder: string; disabled?: boolean }>()
const prompt = defineModel<string>({ required: true })
const { id, disabled, ariaAttrs, emitFormInput, emitFormFocus, emitFormBlur } = useFormField(props)

const editor = useEditor({
  content: prompt.value,
  contentType: 'markdown',
  editable: !disabled.value,
  extensions: [StarterKit.configure({ link: { openOnClick: false } }), Markdown],
  editorProps: {
    attributes: (state) => ({
      ...(id.value ? { id: id.value } : {}),
      ...ariaAttrs.value,
      role: 'textbox',
      'aria-label': props.label,
      'aria-multiline': 'true',
      'aria-disabled': String(!!disabled.value),
      'data-placeholder': props.placeholder,
      class: state.doc.textContent.trim() ? '' : 'is-empty',
    }),
    handlePaste(view, event) {
      if (!view.editable || event.clipboardData?.getData('text/html')) return false
      const text = event.clipboardData?.getData('text/plain')
      if (!text || !editor.value) return false
      editor.value.commands.insertContent(text, { contentType: 'markdown' })
      return true
    },
  },
  onUpdate: ({ editor }) => {
    prompt.value = editor.getMarkdown()
    emitFormInput()
  },
  onFocus: emitFormFocus,
  onBlur: emitFormBlur,
})

watch(prompt, (value) => {
  if (!editor.value || editor.value.getMarkdown() === value) return
  // AI improvements and undo replace the prompt without rewriting their original string.
  editor.value.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
})

watch(disabled, (value) => editor.value?.setEditable(!value, false))

watch([() => props.label, () => props.placeholder], () => {
  if (editor.value) editor.value.setOptions({ editorProps: editor.value.options.editorProps })
})
</script>

<style scoped>
.prompt-input :deep(.tiptap) {
  min-height: 7rem;
  padding: 0.5rem 0.75rem;
  outline: none;
  overflow-wrap: anywhere;
}

.prompt-input :deep(.tiptap > * + *) {
  margin-top: 0.5rem;
}

.prompt-input :deep(strong) {
  font-weight: 700;
}

.prompt-input :deep(ul),
.prompt-input :deep(ol) {
  padding-inline-start: 1.25rem;
}

.prompt-input :deep(ul) {
  list-style-type: disc;
}

.prompt-input :deep(ol) {
  list-style-type: decimal;
}

.prompt-input :deep(.tiptap.is-empty)::before {
  content: attr(data-placeholder);
  color: var(--ui-text-dimmed);
  float: inline-start;
  height: 0;
  pointer-events: none;
}
</style>
