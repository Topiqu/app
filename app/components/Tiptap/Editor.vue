<template>
  <div class="flex min-w-0 max-w-full flex-col" @keydown.tab.exact.stop @keydown.shift.tab.exact.stop>
    <template v-if="editor">
      <div
        class="relative min-w-0 max-w-full overflow-visible rounded-(--topiqu-surface-radius) border border-default bg-default"
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
          @openMedia="openMedia"
          @focusEditor="focusEditor"
        />

        <TiptapToolbarBubble :editor @openLink="(url) => openLink({ type: 'link', url })" />
        <!-- No v-if on bubble menus: Tiptap detaches their element, so unmounting one on an `edit`
             toggle crashes the patch and freezes the whole editor page. They gate on isEditable. -->
        <TiptapToolbarTableBubble :editor />
        <TiptapToolbarImageBubble :editor @replace="openReplace" @inspect="openMediaDetail" />

        <EditorContent
          :editor
          class="article-content editor-canvas min-h-96 min-w-0 max-w-full! overflow-hidden text-highlighted"
          :class="[EDITOR_TABLE_CLASS, contentClass]"
          @click.stop="handleEditorClick"
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
      <MediaPicker v-model:open="mediaPickerOpen" mode="body" @select="onMediaSelect" />
      <MediaDetail :id="mediaDetail.id" v-model:open="mediaDetail.open" @updated="onMediaUpdated" />
    </template>
    <div v-else v-html="content || fallback || $t('articles.editor.noContent')" />
  </div>
</template>

<script setup lang="ts">
import type { ChainedCommands } from '@tiptap/vue-3'
import type { MediaLibraryAsset, MediaPickerSelection } from '~~/shared/types/mediaLibrary'

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
const mediaPickerOpen = shallowRef(false)
/** Position of the image being replaced; `null` inserts a new one. */
let replacePos: number | null = null
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
  if (type === 'image') run((c) => c.setFigure({ src: url, alt: '' }))
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

const handleEditorClick = async () => {
  if (edit.value) return
  edit.value = true
  await nextTick()
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

const openMedia = () => {
  replacePos = null
  mediaPickerOpen.value = true
}

const openReplace = (pos: number) => {
  replacePos = pos
  mediaPickerOpen.value = true
}

const onMediaSelect = (asset: MediaPickerSelection, alt: string) => {
  const attrs = {
    src: asset.deliveryUrl || asset.url,
    alt,
    mediaId: asset.id,
    width: asset.width ?? null,
    height: asset.height ?? null,
  }
  const instance = editor.value
  const node = replacePos === null ? null : instance?.state.doc.nodeAt(replacePos)
  if (!instance || !node || !['figure', 'image'].includes(node.type.name)) return run((c) => c.setFigure(attrs))

  // Layout, caption and link stay; only the asset changes.
  const pos = replacePos!
  instance
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })
      return true
    })
    .setNodeSelection(pos)
    .run()
}

const mediaDetail = shallowReactive({ open: false, id: null as string | null, pos: -1 })

const openMediaDetail = (id: string, pos: number) => Object.assign(mediaDetail, { open: true, id, pos })

// An empty alt picks up the new library default; an alt written for this article is never overwritten.
const onMediaUpdated = (asset?: MediaLibraryAsset) => {
  const alt = asset?.defaultAltText?.trim()
  const instance = editor.value
  const node = instance?.state.doc.nodeAt(mediaDetail.pos)
  if (!alt || !instance || !node || node.attrs.mediaId !== asset!.id || node.attrs.alt?.trim()) return
  instance
    .chain()
    .command(({ tr }) => {
      tr.setNodeMarkup(mediaDetail.pos, undefined, { ...node.attrs, alt })
      return true
    })
    .run()
}

const focusBlock = (blockIndex?: number) => {
  const instance = editor.value
  if (!instance) return false
  const nodes: { pos: number }[] = []
  instance.state.doc.forEach((_node, offset) => nodes.push({ pos: offset + 1 }))
  const target = typeof blockIndex === 'number' ? nodes[blockIndex] : undefined
  instance
    .chain()
    .focus(target?.pos ?? 'start')
    .run()
  return Boolean(target)
}

defineExpose({ focusBlock })
</script>
