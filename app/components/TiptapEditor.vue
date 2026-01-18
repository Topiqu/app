<template>
  <div class="flex flex-col gap-2">
    <template v-if="editor">
      <div v-if="edit" class="flex flex-wrap items-center gap-1">
        <FileInput :uploadImage="uploadImage" @close="onFileInputClose" />
        <Button title="URL" icon="mdi:image-plus" @click="openPrompt('image')" />
        <Button
          icon="mdi-format-paragraph"
          :active="editor.isActive('paragraph')"
          @click="runCmd((c) => c.setParagraph())"
        />
        <Button
          v-for="n in 6"
          :key="n"
          :icon="`mdi-format-header-${n}`"
          :active="editor.isActive('heading', { level: n as Level })"
          @click="runCmd((c) => c.toggleHeading({ level: n as Level }))"
        />
        <Button
          icon="mdi-format-list-bulleted"
          :active="editor.isActive('bulletList')"
          @click="runCmd((c) => c.toggleBulletList())"
        />
        <Button
          icon="mdi-format-list-numbered"
          :active="editor.isActive('orderedList')"
          @click="runCmd((c) => c.toggleOrderedList())"
        />
        <Button
          icon="mdi-format-quote-open"
          :disabled="!editor.can().setBlockquote()"
          @click="runCmd((c) => c.setParagraph().setBlockquote())"
        />
        <Button
          icon="mdi-format-quote-close"
          :disabled="!editor.can().unsetBlockquote()"
          @click="runCmd((c) => c.unsetBlockquote())"
        />
        <Button icon="mdi-youtube" @click="openPrompt('youtube')" />
        <Button icon="mdi-poll" @click="insertPoll" />
        <Button
          v-for="a in ['left', 'center', 'right', 'justify']"
          :key="a"
          :icon="`mdi-format-align-${a}`"
          :active="editor.isActive({ textAlign: a })"
          @click="runCmd((c) => c.setTextAlign(a))"
        />
        <Button icon="mdi-minus" @click="runCmd((c) => c.setHorizontalRule())" />
        <Button icon="mdi-undo" :disabled="!editor.can().undo()" @click="runCmd((c) => c.undo())" />
        <Button icon="mdi-redo" :disabled="!editor.can().redo()" @click="runCmd((c) => c.redo())" />
        <Button icon="mdi-format-clear" @click="runCmd((c) => c.clearNodes())" />

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
          <Button icon="mdi-format-bold" :active="editor.isActive('bold')" @click="runCmd((c) => c.toggleBold())" />
          <Button
            icon="mdi-format-italic"
            :active="editor.isActive('italic')"
            @click="runCmd((c) => c.toggleItalic())"
          />
          <Button
            icon="mdi-format-underline"
            :active="editor.isActive('underline')"
            @click="runCmd((c) => c.toggleUnderline())"
          />
          <Button
            icon="mdi-format-strikethrough"
            :active="editor.isActive('strike')"
            @click="runCmd((c) => c.toggleStrike())"
          />
          <Button
            icon="mdi-link"
            :active="editor.isActive('link')"
            @click="openPrompt('link', editor.getAttributes('link').href)"
          />
        </div>
      </BubbleMenu>

      <Teleport to="body">
        <div
          v-if="linkModal.show"
          class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          @click.self="linkModal.show = false"
        >
          <div
            class="bg-white dark:bg-neutral-900 w-full max-w-md p-6 rounded-2xl shadow-2xl border border-gray-200 dark:border-neutral-800 flex flex-col gap-4"
          >
            <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {{
                linkModal.type === 'link'
                  ? $t('articles.sources.placeholder')
                  : linkModal.type === 'image'
                    ? $t('articles.sources.imageUrl')
                    : $t('articles.sources.youtube')
              }}
            </h3>

            <FormInput
              id="editor-link-input"
              v-model="linkModal.url"
              :placeholder="linkModal.type === 'youtube' ? 'https://youtube.com/...' : 'https://...'"
              :icon="
                linkModal.type === 'image' ? 'mdi:image' : linkModal.type === 'youtube' ? 'mdi:youtube' : 'mdi:link'
              "
              autofocus
              @keydown.enter.prevent.stop="applyLink"
            />

            <div class="flex justify-end gap-2">
              <Button variant="neutral" @click="linkModal.show = false">{{ $t('common.close') }}</Button>
              <Button variant="primary" @click="applyLink">{{ $t('common.continue') }}</Button>
            </div>
          </div>
        </div>
      </Teleport>

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

import tippy from 'tippy.js'
import { useVModel } from '@vueuse/core'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Image } from '@tiptap/extension-image'
import { Color } from '@tiptap/extension-color'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Youtube } from '@tiptap/extension-youtube'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Typography } from '@tiptap/extension-typography'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { FontFamily } from '@tiptap/extension-font-family'
import BubbleMenuExtension from '@tiptap/extension-bubble-menu'
import { CharacterCount } from '@tiptap/extension-character-count'
import { EditorContent, useEditor, VueRenderer, VueNodeViewRenderer } from '@tiptap/vue-3'
import 'tippy.js/dist/tippy.css'

import TiptapImage from '~/components/File/TiptapImage.vue'

import Poll from '../../extensions/poll'
import CommandList from './CommandList.vue'
import SlashCommand from '../../extensions/slashCommand'

const config = useRuntimeConfig()

const CustomBlockquote = Blockquote.extend({
  renderHTML: ({ HTMLAttributes }) => ['blockquote', { class: 'blockquote', ...HTMLAttributes }, 0],
})

const {
  edit,
  fallback = 'No content available',
  limit = 8192,
  ...props
} = defineProps<{ modelValue: string | null; fallback?: string; limit?: number; edit?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'update:edit', value: boolean): void }>()
const content = useVModel(props, 'modelValue', emit, { defaultValue: '<p></p>' })

watch(content, (v) => v || (content.value = '<p></p>'))
const percentage = computed(() => Math.round((100 * (editor.value?.storage.characterCount.characters() || 0)) / limit))

const chain = () => editor.value?.chain().focus()
const runCmd = (fn: (c: any) => any) => fn(chain())?.run()

const linkModal = shallowReactive({ show: false, url: '', type: 'link' as 'link' | 'image' | 'youtube' })

const openPrompt = (type: typeof linkModal.type, val = '') => {
  linkModal.type = type
  linkModal.url = val || ''
  linkModal.show = true
  nextTick(() => document.getElementById('editor-link-input')?.focus())
}

const applyLink = () => {
  const { url, type } = linkModal
  linkModal.show = false

  if (!url && type === 'link') {
    runCmd((c) => c.unsetLink())
    return
  }

  if (url) {
    if (type === 'link') runCmd((c) => c.setLink({ href: url }))
    if (type === 'image') runCmd((c) => c.setImage({ src: url }))
    if (type === 'youtube') runCmd((c) => c.setYoutubeVideo({ src: url }))
  }
}
const uploadImage = async (files: FileList | null) => {
  const file = files?.[0]
  if (!file) return

  const fileExt = file.name.split('.').pop() || 'jpg'
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
  const generatedFilename = `content-${uniqueId}.${fileExt}`
  const optimizedFilename = generatedFilename.replace(/\.[^/.]+$/, '.webp')
  const predictedUrl = `${config.public.cdnUrl}/optimized/${optimizedFilename}`

  editor.value?.commands.setImage({
    src: predictedUrl,
    alt: file.name,
  })
  onFileInputClose()

  const form = new FormData()
  form.append('file', file)
  form.append('customFilename', generatedFilename)

  try {
    const { success } = await $fetch('/api/upload', {
      method: 'POST',
      body: form,
    })

    if (!success) {
      alert('Upload error')
    }
  } catch (e: any) {
    alert('ERR: ' + e.message)
  }
}

const onFileInputClose = () => chain()?.run()
const handleEditorClick = () => (!edit && emit('update:edit', true), chain()?.run())

const insertPoll = () =>
  runCmd((c) =>
    c.insertContent({
      type: 'poll',
      attrs: {
        id: crypto.randomUUID(),
        question: $t('articles.poll.defaultQuestion'),
        options: [1, 2].map((i) => $t('articles.poll.option', { index: i })),
      },
    }),
  )

const setColor = (e: Event) => runCmd((c) => c.setColor((e.target as HTMLInputElement).value || '#000'))
const setFontFamily = (e: Event) => runCmd((c) => c.setFontFamily((e.target as HTMLSelectElement).value || ''))

const validateContent = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  doc.querySelectorAll('div[data-type="poll"]').forEach((p) => {
    const q = (p.getAttribute('data-question') ?? '').trim() || $t('articles.poll.defaultQuestion')
    let o = []
    try {
      o = JSON.parse(p.getAttribute('data-options')!)
    } catch (e) {
      console.error(e)
    }
    o =
      Array.isArray(o) && o.length
        ? o.map((x) => String(x ?? '').trim() || $t('articles.poll.defaultOption'))
        : [$t('articles.poll.defaultOption')]
    if (q !== p.getAttribute('data-question') || JSON.stringify(o) !== p.getAttribute('data-options')) {
      changed = true
      p.setAttribute('data-question', q)
      p.setAttribute('data-options', JSON.stringify(o))
    }
  })
  return changed ? doc.body.innerHTML : html
}

const getSuggestionItems = ({ query }: { query: string }) =>
  [
    {
      title: 'Heading 1',
      icon: 'mdi-format-header-1',
      command: ({ editor, range }: any) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      icon: 'mdi-format-header-2',
      command: ({ editor, range }: any) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      icon: 'mdi-format-header-3',
      command: ({ editor, range }: any) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
    },
    {
      title: 'Bullet List',
      icon: 'mdi-format-list-bulleted',
      command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: 'Numbered List',
      icon: 'mdi-format-list-numbered',
      command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: 'Quote',
      icon: 'mdi-format-quote-open',
      command: ({ editor, range }: any) => editor.chain().focus().deleteRange(range).setBlockquote().run(),
    },
    {
      title: 'Image',
      icon: 'mdi-image',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).run()
        openPrompt('image')
      },
    },
    {
      title: 'YouTube',
      icon: 'mdi-youtube',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).run()
        openPrompt('youtube')
      },
    },
    {
      title: 'Poll',
      icon: 'mdi-poll',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).run()
        insertPoll()
      },
    },
  ].filter((item) => item.title.toLowerCase().startsWith(query.toLowerCase()))

const renderSuggestion = () => {
  let component: any, popup: any
  return {
    onStart: (props: any) => {
      component = new VueRenderer(CommandList, { props, editor: props.editor })
      if (props.clientRect)
        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
    },
    onUpdate(props: any) {
      component.updateProps(props)
      if (props.clientRect) {
        popup[0].setProps({ getReferenceClientRect: props.clientRect })
      }
    },
    onKeyDown: (props: any) =>
      props.event.key === 'Escape' ? (popup[0].hide(), true) : component.ref?.onKeyDown(props),
    onExit() {
      popup?.[0].destroy()
      component?.destroy()
    },
  }
}

const editor = useEditor({
  content: content.value,
  extensions: [
    StarterKit.configure({ blockquote: false }),
    CustomBlockquote.configure({ HTMLAttributes: { class: 'blockquote' } }),
    Image.configure({ inline: true, allowBase64: true, HTMLAttributes: { class: 'max-w-full h-auto rounded' } }).extend(
      {
        addNodeView() {
          return VueNodeViewRenderer(TiptapImage)
        },
      },
    ),
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
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    FontFamily.configure({ types: ['textStyle'] }),
    BubbleMenuExtension.configure({
      shouldShow: ({ editor, state }) =>
        state.selection.from !== state.selection.to && !editor.isActive('tableCell') && !editor.isActive('tableHeader'),
    }),
    SlashCommand.configure({ suggestion: { items: getSuggestionItems, render: renderSuggestion } as any }),
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
