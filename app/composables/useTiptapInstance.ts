import type { Ref } from 'vue'

import { useDebounceFn } from '@vueuse/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Indent } from '~~/extensions/indent'
import { Image } from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import { Youtube } from '@tiptap/extension-youtube'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { FontFamily } from '@tiptap/extension-font-family'
import { useEditor, VueNodeViewRenderer } from '@tiptap/vue-3'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { CharacterCount } from '@tiptap/extension-character-count'

import TiptapImage from '~/components/File/TiptapImage.vue'
// eslint-disable-next-line
import Poll from '~~/extensions/poll'
import SlashCommand from '~~/extensions/slashCommand'

const CustomBlockquote = Blockquote.extend({
  renderHTML: ({ HTMLAttributes }) => ['blockquote', { class: 'blockquote', ...HTMLAttributes }, 0],
})

export interface UseTiptapInstanceOptions {
  content: Ref<string | null>
  edit: Ref<boolean>
  limit: number
  slashCommand: any
  onChange: (html: string) => void
  onDropFiles: (files: File[]) => void
}

export function useTiptapInstance(opts: UseTiptapInstanceOptions) {
  const debouncedChange = useDebounceFn((html: string) => opts.onChange(html), 200)

  const editor = useEditor({
    content: opts.content.value ?? '<p></p>',
    extensions: [
      StarterKit.configure({ blockquote: false }),
      CustomBlockquote.configure({ HTMLAttributes: { class: 'blockquote' } }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: 'max-w-full h-auto rounded' },
      }).extend({
        addNodeView() {
          return VueNodeViewRenderer(TiptapImage)
        },
      }),
      Dropcursor,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Typography,
      CharacterCount.configure({ limit: opts.limit }),
      Link.configure({ openOnClick: false, defaultProtocol: 'https', HTMLAttributes: { class: 'link' } }),
      Youtube.configure({
        HTMLAttributes: { class: 'youtube-video' },
        inline: false,
        allowFullscreen: true,
        ccLanguage: 'cs',
      }),
      Poll,
      Indent,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      FontFamily.configure({ types: ['textStyle'] }),
      BubbleMenuExtension.configure({
        shouldShow: ({ editor, state }) =>
          state.selection.from !== state.selection.to &&
          !editor.isActive('tableCell') &&
          !editor.isActive('tableHeader'),
      }),
      SlashCommand.configure({ suggestion: opts.slashCommand }),
    ],
    editable: opts.edit.value,
    editorProps: {
      handleDrop(_, event, __, moved) {
        if (moved) return false
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (!files.length) return false
        event.preventDefault()
        opts.onDropFiles(files)
        return true
      },
      handlePaste(_, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (!files.length) return false
        event.preventDefault()
        opts.onDropFiles(files)
        return true
      },
    },
    onUpdate: ({ editor }) => debouncedChange(editor.getHTML()),
  })

  watch(opts.content, (v) => {
    if (editor.value?.getHTML() !== v) editor.value?.commands.setContent(v ?? '<p></p>')
  })
  watchEffect(() => editor.value?.setEditable(opts.edit.value))
  onBeforeUnmount(() => editor.value?.destroy())

  return editor
}
