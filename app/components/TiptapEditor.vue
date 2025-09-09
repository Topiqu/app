<template>
  <div class="flex flex-col gap-2">
    <template v-if="editor">
      <div v-if="edit" class="flex items-center flex-wrap gap-x-2 gap-y-1">
        <FileInput :uploadImage="uploadImage" @close="onFileInputClose" />
        <Button
          title="Paragraph"
          icon="mdi-format-paragraph"
          :active="editor.isActive('paragraph')"
          @click="editor.chain().focus().setParagraph().run()"
        />
        <Button
          title="Heading 1"
          icon="mdi-format-header-1"
          :active="editor.isActive('heading', { level: 1 })"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        />
        <Button
          title="Heading 2"
          icon="mdi-format-header-2"
          :active="editor.isActive('heading', { level: 2 })"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        />
        <Button
          title="Heading 3"
          icon="mdi-format-header-3"
          :active="editor.isActive('heading', { level: 3 })"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        />
        <Button
          title="Heading 4"
          icon="mdi-format-header-4"
          :active="editor.isActive('heading', { level: 4 })"
          @click="editor.chain().focus().toggleHeading({ level: 4 }).run()"
        />
        <Button
          title="Heading 5"
          icon="mdi-format-header-5"
          :active="editor.isActive('heading', { level: 5 })"
          @click="editor.chain().focus().toggleHeading({ level: 5 }).run()"
        />
        <Button
          title="Heading 6"
          icon="mdi-format-header-6"
          :active="editor.isActive('heading', { level: 6 })"
          @click="editor.chain().focus().toggleHeading({ level: 6 }).run()"
        />
        <Button
          title="Bullet List"
          icon="mdi-format-list-bulleted"
          :active="editor.isActive('bulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        />
        <Button
          title="Ordered List"
          icon="mdi-format-list-numbered"
          :active="editor.isActive('orderedList')"
          @click="editor.chain().focus().toggleOrderedList().run()"
        />
        <Button
          title="Set Blockquote"
          icon="mdi-format-quote-open"
          :disabled="!editor.can().setBlockquote()"
          @click="setBlockquote"
        />
        <Button
          title="Unset Blockquote"
          icon="mdi-format-quote-close"
          :disabled="!editor.can().unsetBlockquote()"
          @click="unsetBlockquote"
        />
        <Button title="Insert YouTube Video" icon="mdi-youtube" @click="insertYoutube" />
        <Button title="Insert Poll" icon="mdi-poll" @click="insertPoll" />
        <Button
          title="Align Left"
          icon="mdi-format-align-left"
          :active="editor.isActive({ textAlign: 'left' })"
          @click="editor.chain().focus().setTextAlign('left').run()"
        />
        <Button
          title="Align Center"
          icon="mdi-format-align-center"
          :active="editor.isActive({ textAlign: 'center' })"
          @click="editor.chain().focus().setTextAlign('center').run()"
        />
        <Button
          title="Align Right"
          icon="mdi-format-align-right"
          :active="editor.isActive({ textAlign: 'right' })"
          @click="editor.chain().focus().setTextAlign('right').run()"
        />
        <Button
          title="Align Justify"
          icon="mdi-format-align-justify"
          :active="editor.isActive({ textAlign: 'justify' })"
          @click="editor.chain().focus().setTextAlign('justify').run()"
        />
        <Button title="Horizontal Rule" icon="mdi-minus" @click="editor.chain().focus().setHorizontalRule().run()" />
        <Button
          title="Undo"
          icon="mdi-undo"
          :disabled="!editor.can().chain().focus().undo().run()"
          @click="editor.chain().focus().undo().run()"
        />
        <Button
          title="Redo"
          icon="mdi-redo"
          :disabled="!editor.can().chain().focus().redo().run()"
          @click="editor.chain().focus().redo().run()"
        />
        <Button title="Clear Nodes" icon="mdi-format-clear" @click="editor.chain().focus().clearNodes().run()" />
        <select
          class="h-9 px-3 rounded-full border border-gray-300 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          @mousedown.stop
          @click.stop
          @change="setFontFamily"
        >
          <option value="">Výchozí</option>
          <option value="Arial">Arial</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
        </select>
        <div class="relative w-9 h-9 inline-flex items-center justify-center flex-shrink-0">
          <span
            class="absolute inset-0 rounded-full border border-gray-300"
            :style="{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }"
          />
          <input
            type="color"
            class="absolute inset-0 opacity-0 cursor-pointer"
            :value="editor.getAttributes('textStyle').color || '#000000'"
            @mousedown.stop
            @click.stop
            @input="setColor"
          />
        </div>
        <div
          :class="{
            'flex items-center text-green-500 text-xs gap-2 ml-auto': true,
            'text-red-500': editor.storage.characterCount.characters() === limit,
          }"
        >
          <svg height="40" width="40" viewBox="0 0 40 40">
            <circle r="15" cx="20" cy="20" fill="#e9ecef" />
            <circle
              r="5"
              cx="20"
              cy="20"
              fill="transparent"
              stroke="currentColor"
              stroke-width="20"
              :stroke-dasharray="`calc(${percentage} * 31.4 / 100) 31.4`"
              transform="rotate(-90) translate(-40)"
            />
            <circle r="6" cx="20" cy="20" fill="white" />
          </svg>
          <span>
            {{ editor.storage.characterCount.characters() }} / {{ limit }} characters
            <br />
            {{ editor.storage.characterCount.words() }} words
          </span>
        </div>
      </div>
      <BubbleMenu
        v-if="editor"
        :editor="editor"
        :options="{ placement: 'top', size: { padding: { top: 8, right: 12, bottom: 8, left: 12 } } }"
      >
        <div
          class="flex flex-row items-center flex-nowrap whitespace-nowrap bg-white border border-gray-200 shadow-xl px-4 py-2 rounded-full bg-opacity-95 backdrop-blur-md space-x-3"
        >
          <Button
            icon="mdi:format-bold"
            title="Bold"
            :active="editor.isActive('bold')"
            @click="editor.chain().focus().toggleBold().run()"
          />
          <Button
            icon="mdi:format-italic"
            title="Italic"
            :active="editor.isActive('italic')"
            @click="editor.chain().focus().toggleItalic().run()"
          />
          <Button
            icon="mdi:format-underline"
            title="Underline"
            :active="editor.isActive('underline')"
            @click="editor.chain().focus().toggleUnderline().run()"
          />
          <Button
            icon="mdi:format-strikethrough"
            title="Strike"
            :active="editor.isActive('strike')"
            @click="editor.chain().focus().toggleStrike().run()"
          />
          <Button icon="mdi:link" title="Insert Link" :active="editor.isActive('link')" @click="setLink" />
        </div>
      </BubbleMenu>
      <EditorContent
        :editor="editor"
        :class="{
          'rounded-lg shadow-sm': edit,
          'h-96 p-4 bg-white border border-gray-300 overflow-y-auto': true,
        }"
        @click.stop.prevent="handleEditorClick"
      />
    </template>
    <div v-else class="text-black" v-html="content ? content : fallback" />
  </div>
</template>

<script lang="ts" setup>
import { useVModel } from '@vueuse/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Youtube } from '@tiptap/extension-youtube'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { Blockquote } from '@tiptap/extension-blockquote'
import { FontFamily } from '@tiptap/extension-font-family'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { CharacterCount } from '@tiptap/extension-character-count'

import Poll from '../../extensions/poll'

const CustomBlockquote = Blockquote.extend({
  renderHTML({ HTMLAttributes }) {
    return ['blockquote', { class: 'blockquote', ...HTMLAttributes }, 0]
  },
})

const {
  edit,
  fallback = 'No content available',
  limit = 8192,
  ...props
} = defineProps<{
  modelValue: string | null
  fallback?: string
  limit?: number
  edit?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'update:edit', value: boolean): void
}>()

const content = useVModel(props, 'modelValue', emit)
if (!content.value) content.value = '<p></p>'

watch(content, (newVal) => {
  if (!newVal) content.value = '<p></p>'
})

const percentage = computed(() => Math.round((100 / limit) * (editor.value?.storage.characterCount.characters() || 0)))

const uploadImage = async (files: FileList | null) => {
  const file = files?.item(0)
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData })

    const { url, error } = await res.json()

    if (error) return alert(error)

    editor.value?.commands.setImage({ src: url, alt: file.name })
  } catch (err) {
    alert('Chyba při nahrávání obrázku: ' + (err as Error).message)
  }
}

const onFileInputClose = () => editor.value?.chain().focus().run()

const handleEditorClick = () => {
  if (!edit) emit('update:edit', true)
  editor.value?.chain().focus().run()
}

const setBlockquote = () => editor.value?.chain().focus().setParagraph().setBlockquote().run()

const unsetBlockquote = () => editor.value?.chain().focus().unsetBlockquote().run()

const insertYoutube = () => {
  const url = window.prompt('Zadejte URL YouTube videa:')
  if (url) editor.value?.chain().focus().setYoutubeVideo({ src: url }).run()
}

const insertPoll = () =>
  editor.value
    ?.chain()
    .focus()
    .insertContent({
      type: 'poll',
      attrs: { id: crypto.randomUUID(), question: 'Zadej otázku', options: ['Možnost 1', 'Možnost 2'] },
    })
    .run()

const setLink = () => {
  const previousUrl = editor.value?.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)
  if (url === null) return
  if (url === '') return editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  if (url && !previousUrl) return editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

const setColor = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target && editor.value) {
    editor.value
      .chain()
      .focus()
      .setColor(target.value || '#000000')
      .run()
  }
}

const setFontFamily = (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target && editor.value) {
    const value = target.value
    editor.value
      .chain()
      .focus()
      .setFontFamily(value || '')
      .run()
  }
}

const validateContent = (html: string) => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  let modified = false

  doc.querySelectorAll('div[data-type="poll"]').forEach((poll) => {
    const rawQuestion = poll.getAttribute('data-question') ?? ''
    const normalizedQuestion = String(rawQuestion).trim() || 'Zadej otázku'
    if (normalizedQuestion !== rawQuestion) modified = true

    const rawOptions = poll.getAttribute('data-options')
    let parsed: unknown
    try {
      parsed = rawOptions ? JSON.parse(rawOptions) : []
    } catch {
      parsed = []
      modified = true
    }

    let options = Array.isArray(parsed) ? parsed : []
    const before = JSON.stringify(options)
    options =
      options.length > 0
        ? options.map((opt, i) => {
            const s = String(opt ?? '').trim()
            return s || `Možnost ${i + 1}`
          })
        : ['Možnost 1']
    const after = JSON.stringify(options)
    if (after !== before) modified = true

    poll.setAttribute('data-question', normalizedQuestion)
    poll.setAttribute('data-options', after)
  })

  return modified ? doc.body.innerHTML : html
}

const editor = useEditor({
  content: content.value,
  extensions: [
    StarterKit.configure({
      blockquote: false,
    }),
    CustomBlockquote.configure({
      HTMLAttributes: { class: 'blockquote' },
    }),
    Image.configure({
      inline: true,
      HTMLAttributes: { class: 'max-w-full h-auto rounded' },
    }),
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Typography,
    CharacterCount.configure({ limit }),
    Link.configure({
      openOnClick: false,
      defaultProtocol: 'https',
      HTMLAttributes: { class: 'link' },
    }),
    Youtube.configure({
      HTMLAttributes: { class: 'youtube-video' },
      inline: false,
      allowFullscreen: true,
      ccLanguage: 'cs',
    }),
    Poll,
    BubbleMenuExtension.configure({
      shouldShow: ({ editor }) => {
        return (
          editor.isActive('text') &&
          !editor.isActive('image') &&
          !editor.isActive('youtube') &&
          !editor.isActive('poll')
        )
      },
    }),
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    FontFamily.configure({ types: ['textStyle'] }),
  ],
  editable: edit,
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    content.value = validateContent(html)
  },
})

watch(content, (newValue) => {
  if (editor.value && editor.value.getHTML() !== newValue) {
    editor.value.commands.setContent(newValue)
  }
})

watchEffect(() => editor.value?.setEditable(edit))

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style>
div.tiptap.ProseMirror {
  width: 100%;
  height: 100%;
}
.ProseMirror img {
  max-width: 100%;
  max-height: 300px;
  height: auto;
  object-fit: contain;
}
.ProseMirror p,
.ProseMirror h1,
.ProseMirror h2,
.ProseMirror h3,
.ProseMirror h4,
.ProseMirror h5,
.ProseMirror h6 {
  color: #000;
}
.ProseMirror blockquote.blockquote {
  border-left: 4px solid #3b82f6;
  background-color: #f9fafb;
  padding: 12px 16px;
  margin: 16px 0;
  color: #1f2937;
  font-style: italic;
  border-radius: 4px;
}
html.dark .ProseMirror blockquote.blockquote {
  background-color: #374151;
  color: #e5e7eb;
  border-left: 4px solid #60a5fa;
}
.ProseMirror iframe.youtube-video {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16/9;
  border-radius: 8px;
  margin: 16px 0;
}
html.dark .ProseMirror iframe.youtube-video {
  background-color: #374151;
}
.ProseMirror .poll-node {
  border: 1px solid #ccc;
  padding: 12px;
  margin: 16px 0;
  border-radius: 4px;
  background-color: #f9fafb;
}
html.dark .ProseMirror .poll-node {
  background-color: #374151;
  border-color: #4b5563;
}
.ProseMirror .poll-node input {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}
.ProseMirror .poll-node button {
  padding: 4px 8px;
  margin-left: 8px;
  background-color: #3b82f6;
  color: white;
  border-radius: 4px;
}
html.dark .ProseMirror .poll-node button {
  background-color: #60a5fa;
}
.color-swatch {
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
  border-radius: 9999px;
  overflow: hidden;
}
.color-swatch::-webkit-color-swatch-wrapper {
  padding: 0;
  border-radius: 9999px;
}
.color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 9999px;
}
.color-swatch::-moz-color-swatch {
  border: none;
  border-radius: 9999px;
}
</style>
