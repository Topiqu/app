import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Indent } from '~~/extensions/indent'
import { Color } from '@tiptap/extension-color'
import { InlineImage } from '~~/extensions/image'
import { Youtube } from '@tiptap/extension-youtube'
import SlashCommand from '~~/extensions/slashCommand'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { Table, TableRow } from '@tiptap/extension-table'
import { AiDisclosure } from '~~/extensions/aiDisclosure'
import { Figcaption, Figure } from '~~/extensions/figure'
import { FontFamily } from '@tiptap/extension-font-family'
import { useEditor, VueNodeViewRenderer } from '@tiptap/vue-3'
import { CharacterCount } from '@tiptap/extension-character-count'
import { ColoredTableCell, ColoredTableHeader } from '~~/extensions/tableCellColor'
// eslint-disable-next-line
import Poll from '~~/extensions/poll'

import TiptapImage from '~/components/File/TiptapImage.vue'
import TiptapFigure from '~/components/File/TiptapFigure.vue'

const CustomBlockquote = Blockquote.extend({
  renderHTML: ({ HTMLAttributes }) => ['blockquote', { class: 'blockquote', ...HTMLAttributes }, 0],
})

export interface UseTiptapInstanceOptions {
  content: Ref<string | null>
  edit: Ref<boolean>
  limit: number
  slashCommand: ReturnType<typeof useTiptapSlashCommand>['suggestion']
  onChange: (html: string) => void
  onDropFiles: (files: File[]) => void
  ariaLabel: string
}

export function useTiptapInstance(opts: UseTiptapInstanceOptions) {
  // Save, language switching and navigation must see the latest edit immediately. Recognizing
  // the parent's echo avoids serializing the full document a second time for that same update.
  let lastEmitted: string | null = null

  const editor = useEditor({
    content: opts.content.value ?? '<p></p>',
    extensions: [
      StarterKit.configure({ blockquote: false, dropcursor: false, link: false, underline: false }),
      CustomBlockquote.configure({ HTMLAttributes: { class: 'blockquote' } }),
      InlineImage.extend({ addNodeView: () => VueNodeViewRenderer(TiptapImage) }),
      Figure.extend({ addNodeView: () => VueNodeViewRenderer(TiptapFigure) }),
      Figcaption,
      AiDisclosure,
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
      // Matches the 7rem cell min-width in main.css, so dragging cannot go below what CSS renders.
      Table.configure({ resizable: true, cellMinWidth: 112 }),
      TableRow,
      ColoredTableHeader,
      ColoredTableCell,
      Poll,
      Indent,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      FontFamily.configure({ types: ['textStyle'] }),
      SlashCommand.configure({ suggestion: opts.slashCommand }),
    ],
    editable: opts.edit.value,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': opts.ariaLabel },
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
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastEmitted = html
      opts.onChange(html)
    },
  })

  watch(opts.content, (v) => {
    // Anything the parent transforms on the way through (sanitising, AI streaming, loading a
    // draft) differs from what we emitted and still takes the full compare below. Loading a
    // translation must not emit an edit event: Tiptap may normalize its HTML while parsing it.
    if (v === lastEmitted) return
    if (editor.value?.getHTML() !== v) editor.value?.commands.setContent(v ?? '<p></p>', { emitUpdate: false })
  })
  // `setEditable` emits `update` by default, which would write TipTap's normalized HTML back as an edit.
  watchEffect(() => editor.value?.setEditable(opts.edit.value, false))
  return editor
}
