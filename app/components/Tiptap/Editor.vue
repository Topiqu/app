<template>
  <div class="flex flex-col gap-2" @keydown.tab.exact.stop @keydown.shift.tab.exact.stop>
    <template v-if="editor">
      <TiptapToolbar
        v-if="edit"
        :editor
        :limit
        @openLink="openLink"
        @insertPoll="insertPoll"
        @uploadFile="uploadImage"
        @focusEditor="focusEditor"
      />

      <TiptapToolbarBubble :editor @openLink="(url) => openLink({ type: 'link', url })" />

      <div
        class="relative"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent
        @dragleave.prevent="onDragLeave"
        @drop="onDrop"
      >
        <EditorContent
          :editor
          :class="['h-96 p-4 bg-white border border-gray-300 overflow-y-auto', { 'rounded-lg shadow-sm': edit }]"
          @click.stop.prevent="handleEditorClick"
        />
        <TiptapDropOverlay :active="isDragging && edit" />
      </div>

      <TiptapLinkModal
        v-model:open="linkModal.show"
        v-model:url="linkModal.url"
        :type="linkModal.type"
        :isLinkActive="editor.isActive('link')"
        @submit="applyLink"
        @remove="removeLink"
      />

      <TiptapAltModal v-model:open="altModal.show" :defaultAlt="altModal.defaultAlt" @submit="onAltSubmit" />
    </template>
    <div v-else v-html="content || fallback" />
  </div>
</template>

<script setup lang="ts">
import type { ChainedCommands } from '@tiptap/vue-3'

import { EditorContent } from '@tiptap/vue-3'

const content = defineModel<string | null>({ default: '<p></p>' })
const edit = defineModel<boolean>('edit', { default: false })

const { fallback = 'No content available', limit = 8192 } = defineProps<{
  fallback?: string
  limit?: number
}>()

watch(content, (v) => v || (content.value = '<p></p>'))

const linkModal = shallowReactive({
  show: false,
  url: '',
  type: 'link' as 'link' | 'image' | 'youtube',
})

const altModal = shallowReactive({ show: false, defaultAlt: '' })
let altResolver: ((alt: string) => void) | null = null

const promptAlt = (defaultAlt: string) =>
  new Promise<string>((resolve) => {
    altModal.defaultAlt = defaultAlt
    altModal.show = true
    altResolver = resolve
  })

const onAltSubmit = (alt: string) => {
  altResolver?.(alt)
  altResolver = null
}

const dragDepth = shallowRef(0)
const isDragging = computed(() => dragDepth.value > 0)

const onDragEnter = (e: DragEvent) => {
  if (e.dataTransfer?.types.includes('Files')) dragDepth.value++
}
const onDragLeave = () => (dragDepth.value = Math.max(0, dragDepth.value - 1))
const onDrop = () => (dragDepth.value = 0)

const openLink = ({ type, url = '' }: { type: 'link' | 'image' | 'youtube'; url?: string }) => {
  linkModal.type = type
  linkModal.url = url
  linkModal.show = true
}

const normalizeYoutubeUrl = (raw: string): string => {
  try {
    const u = new URL(raw)
    let id: string | null = null
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1)
    else if (u.hostname.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] ?? null
      else id = u.searchParams.get('v')
    }
    return id ? `https://www.youtube.com/watch?v=${id}` : raw
  } catch {
    return raw
  }
}

const run = (fn: (c: ChainedCommands) => ChainedCommands) => {
  const c = editor.value?.chain().focus()
  if (c) fn(c).run()
}

const applyLink = (url: string) => {
  const { type } = linkModal
  if (!url && type === 'link') return run((c) => c.unsetLink())
  if (!url) return
  if (type === 'link') run((c) => c.setLink({ href: url }))
  if (type === 'image') run((c) => c.setImage({ src: url, alt: '' }))
  if (type === 'youtube') run((c) => c.setYoutubeVideo({ src: normalizeYoutubeUrl(url) }))
}

const removeLink = () => run((c) => c.unsetLink())

const insertPoll = () =>
  run((c) =>
    c.insertContent({
      type: 'poll',
      attrs: {
        id: crypto.randomUUID(),
        question: $t('articles.poll.defaultQuestion'),
        options: [1, 2].map((i) => $t('articles.poll.option', { index: i })),
      },
    }),
  )

const focusEditor = () => editor.value?.chain().focus().run()

const handleEditorClick = () => {
  if (!edit.value) edit.value = true
  focusEditor()
}

const validateContent = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  doc.querySelectorAll('div[data-type="poll"]').forEach((p) => {
    const q = (p.getAttribute('data-question') ?? '').trim() || $t('articles.poll.defaultQuestion')
    let o: string[] = []
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

const { suggestion } = useTiptapSlashCommand({
  openImagePrompt: () => openLink({ type: 'image' }),
  openYoutubePrompt: () => openLink({ type: 'youtube' }),
  insertPoll: () => insertPoll(),
})

const editor = useTiptapInstance({
  content,
  edit,
  limit,
  slashCommand: suggestion,
  onChange: (html) => (content.value = validateContent(html)),
  onDropFiles: (files) => uploadImage(files),
})

const uploadImage = useTiptapImageUpload(editor, promptAlt)
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
</style>
