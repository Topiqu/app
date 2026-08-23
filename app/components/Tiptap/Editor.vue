<template>
  <div class="flex flex-col" @keydown.tab.exact.stop @keydown.shift.tab.exact.stop>
    <template v-if="editor">
      <div
        class="relative rounded-[var(--topiqu-surface-radius)] border border-default bg-default"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent
        @dragleave.prevent="onDragLeave"
        @drop="onDrop"
      >
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

        <EditorContent
          :editor
          class="editor-canvas min-h-96 text-highlighted"
          :class="[EDITOR_TABLE_CLASS, contentClass]"
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
    <div v-else v-html="content || fallback || $t('articles.editor.noContent')" />
  </div>
</template>

<script setup lang="ts">
import type { ChainedCommands } from '@tiptap/vue-3'

import { EditorContent } from '@tiptap/vue-3'
import { pollOptionsAttr } from '~~/shared/utils/polls'
import { EDITOR_TABLE_CLASS } from '~~/shared/utils/articleProse'

const content = defineModel<string | null>({ default: '<p></p>' })
const edit = defineModel<boolean>('edit', { default: false })

const { fallback, limit = 8192 } = defineProps<{
  fallback?: string
  limit?: number
  contentClass?: string
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
    let raw: unknown = []
    try {
      raw = JSON.parse(p.getAttribute('data-options') ?? '[]')
    } catch (e) {
      console.error(e)
    }

    // This used to run `String(x)` per entry, assuming the legacy string[] shape: on every
    // keystroke it rewrote each label as "[object Object]" and dropped the option id.
    const options = pollOptionsAttr(raw, $t('articles.poll.defaultOption'))

    if (q !== p.getAttribute('data-question') || options !== p.getAttribute('data-options')) {
      changed = true
      p.setAttribute('data-question', q)
      p.setAttribute('data-options', options)
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
  ariaLabel: $t('articles.editor.title'),
})

const uploadImage = useTiptapImageUpload(editor, promptAlt)
</script>
