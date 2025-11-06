<template>
  <div class="flex flex-col gap-2">
    <template v-if="editor">
      <div v-if="edit" class="flex flex-wrap items-center gap-1">
        <FileInput :uploadImage="uploadImage" @close="onFileInputClose" />
        <Button title="URL" icon="mdi:image-plus" @click="addImageFromUrl" />
        <Button
          icon="mdi-format-paragraph"
          :active="editor.isActive('paragraph')"
          @click="editor.chain().focus().setParagraph().run()"
        />
        <Button
          v-for="n in 6"
          :key="n"
          :icon="`mdi-format-header-${n}`"
          :active="editor.isActive('heading', { level: n as Level })"
          @click="
            editor
              .chain()
              .focus()
              .toggleHeading({ level: n as Level })
              .run()
          "
        />
        <Button
          icon="mdi-format-list-bulleted"
          :active="editor.isActive('bulletList')"
          @click="editor.chain().focus().toggleBulletList().run()"
        />
        <Button
          icon="mdi-format-list-numbered"
          :active="editor.isActive('orderedList')"
          @click="editor.chain().focus().toggleOrderedList().run()"
        />
        <Button icon="mdi-format-quote-open" :disabled="!editor.can().setBlockquote()" @click="setBlockquote" />
        <Button icon="mdi-format-quote-close" :disabled="!editor.can().unsetBlockquote()" @click="unsetBlockquote" />
        <Button icon="mdi-youtube" @click="insertYoutube" />
        <Button icon="mdi-poll" @click="insertPoll" />
        <Button
          v-for="a in ['left', 'center', 'right', 'justify']"
          :key="a"
          :icon="`mdi-format-align-${a}`"
          :active="editor.isActive({ textAlign: a })"
          @click="editor.chain().focus().setTextAlign(a).run()"
        />
        <Button icon="mdi-minus" @click="editor.chain().focus().setHorizontalRule().run()" />
        <Button icon="mdi-undo" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()" />
        <Button icon="mdi-redo" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()" />
        <Button icon="mdi-format-clear" @click="editor.chain().focus().clearNodes().run()" />
        <select
          class="h-9 px-3 rounded-full border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div class="relative w-9 h-9">
          <span
            class="absolute inset-0 rounded-full border border-gray-300"
            :style="{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }"
          />
          <input
            type="color"
            class="absolute inset-0 opacity-0 cursor-pointer"
            :value="editor.getAttributes('textStyle').color || '#000'"
            @mousedown.stop
            @click.stop
            @input="setColor"
          />
        </div>
        <div
          :class="[
            'ml-auto text-xs flex items-center gap-2',
            editor.storage.characterCount.characters() === limit ? 'text-red-500' : 'text-green-500',
          ]"
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
              :stroke-dasharray="`${percentage * 0.314} 31.4`"
              transform="rotate(-90) translate(-40)"
            />
            <circle r="6" cx="20" cy="20" fill="white" />
          </svg>
          <span>
            {{ editor.storage.characterCount.characters() }} / {{ limit }}<br />
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
          class="flex items-center gap-3 bg-white border border-gray-200 shadow-xl px-4 py-2 rounded-full bg-opacity-95 backdrop-blur-md"
        >
          <Button
            icon="mdi-format-bold"
            :active="editor.isActive('bold')"
            @click="editor.chain().focus().toggleBold().run()"
          />
          <Button
            icon="mdi-format-italic"
            :active="editor.isActive('italic')"
            @click="editor.chain().focus().toggleItalic().run()"
          />
          <Button
            icon="mdi-format-underline"
            :active="editor.isActive('underline')"
            @click="editor.chain().focus().toggleUnderline().run()"
          />
          <Button
            icon="mdi-format-strikethrough"
            :active="editor.isActive('strike')"
            @click="editor.chain().focus().toggleStrike().run()"
          />
          <Button icon="mdi-link" :active="editor.isActive('link')" @click="setLink" />
        </div>
      </BubbleMenu>
      <EditorContent
        :editor="editor"
        :class="{ 'rounded-lg shadow-sm': edit, 'h-96 p-4 bg-white border border-gray-300 overflow-y-auto': true }"
        @click.stop.prevent="handleEditorClick"
      />
    </template>
    <div v-else v-html="content || fallback" />
  </div>
</template>

<script setup lang="ts">
import type { Level } from '@tiptap/extension-heading'

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
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { FontFamily } from '@tiptap/extension-font-family'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { CharacterCount } from '@tiptap/extension-character-count'

import Poll from '../../extensions/poll'

const CustomBlockquote = Blockquote.extend({
  renderHTML: ({ HTMLAttributes }) => ['blockquote', { class: 'blockquote', ...HTMLAttributes }, 0],
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

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'update:edit', value: boolean): void }>()
const content = useVModel(props, 'modelValue', emit, { defaultValue: '<p></p>' })

watch(content, (v) => v || (content.value = '<p></p>'))
const percentage = computed(() => Math.round((100 * (editor.value?.storage.characterCount.characters() || 0)) / limit))

const uploadImage = async (files: FileList | null) => {
  const file = files?.[0]
  if (!file) return
  const form = new FormData()
  form.append('file', file)
  try {
    const { url, success } = await $fetch('/api/upload', { method: 'POST', body: form })

    if (!success) alert('Upload error')
    else editor.value?.commands.setImage({ src: url, alt: file.name })
  } catch (e: any) {
    alert('ERR: ' + e.message)
  }
}

const addImageFromUrl = () => {
  const url = prompt('URL:')
  if (url) editor.value?.chain().focus().setImage({ src: url }).run()
}
const onFileInputClose = () => editor.value?.chain().focus().run()
const handleEditorClick = () => {
  if (!edit) emit('update:edit', true)
  editor.value?.chain().focus().run()
}

const setBlockquote = () => editor.value?.chain().focus().setParagraph().setBlockquote().run()
const unsetBlockquote = () => editor.value?.chain().focus().unsetBlockquote().run()
const insertYoutube = () => {
  const url = prompt('YouTube URL:')
  if (url) editor.value?.chain().focus().setYoutubeVideo({ src: url }).run()
}

const insertPoll = () =>
  editor.value
    ?.chain()
    .focus()
    .insertContent({
      type: 'poll',
      attrs: {
        id: crypto.randomUUID(),
        question: $t('articles.poll.defaultQuestion'),
        options: [1, 2].map((i) => $t('articles.poll.option', { index: i })),
      },
    })
    .run()

const setLink = () => {
  const url = prompt('URL', editor.value?.getAttributes('link').href)
  if (url === null) return

  if (url === '') editor.value?.chain().focus().unsetLink().run()
  else editor.value?.chain().focus().setLink({ href: url }).run()
}

const setColor = (e: Event) =>
  editor.value
    ?.chain()
    .focus()
    .setColor((e.target as HTMLInputElement).value || '#000')
    .run()
const setFontFamily = (e: Event) =>
  editor.value
    ?.chain()
    .focus()
    .setFontFamily((e.target as HTMLSelectElement).value || '')
    .run()

const validateContent = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  doc.querySelectorAll('div[data-type="poll"]').forEach((poll) => {
    const question = (poll.getAttribute('data-question') ?? '').trim() || $t('articles.poll.defaultQuestion')
    let opts: string[] = []
    try {
      opts = poll.getAttribute('data-options') ? JSON.parse(poll.getAttribute('data-options')!) : []
    } catch (e: any) {
      console.error(e)
    }
    opts =
      Array.isArray(opts) && opts.length
        ? opts.map((o) => String(o ?? '').trim() || $t('articles.poll.defaultOption'))
        : [$t('articles.poll.defaultOption')]
    if (question !== poll.getAttribute('data-question') || JSON.stringify(opts) !== poll.getAttribute('data-options'))
      changed = true
    poll.setAttribute('data-question', question)
    poll.setAttribute('data-options', JSON.stringify(opts))
  })
  return changed ? doc.body.innerHTML : html
}

const editor = useEditor({
  content: content.value,
  extensions: [
    StarterKit.configure({ blockquote: false }),
    CustomBlockquote.configure({ HTMLAttributes: { class: 'blockquote' } }),
    Image.configure({ inline: true, HTMLAttributes: { class: 'max-w-full h-auto rounded' } }),
    Dropcursor,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    CharacterCount.configure({ limit }),
    Link.configure({ openOnClick: false, defaultProtocol: 'https', HTMLAttributes: { class: 'link' } }),
    Youtube.configure({
      HTMLAttributes: { class: 'youtube-video' },
      inline: false,
      allowFullscreen: true,
      ccLanguage: 'cs',
    }),
    Poll,
    BubbleMenuExtension.configure({
      shouldShow: ({ editor, state }) =>
        state.selection.from !== state.selection.to && !editor.isActive('tableCell') && !editor.isActive('tableHeader'),
    }),
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    FontFamily.configure({ types: ['textStyle'] }),
  ],
  editable: edit,
  onUpdate: ({ editor }) => (content.value = validateContent(editor.getHTML())),
})

watch(content, (v) => editor.value?.getHTML() !== v && editor.value?.commands.setContent(v))
watchEffect(() => editor.value?.setEditable(edit))
onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped>
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
