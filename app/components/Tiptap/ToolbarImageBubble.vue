<template>
  <BubbleMenu
    :editor="editor"
    pluginKey="imageBubbleMenu"
    :shouldShow="shouldShow"
    :appendTo="getBubbleContainer"
    :updateDelay="0"
    :options="{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 } }"
    class="z-popover flex max-w-[calc(100vw-1rem)] items-center gap-1 rounded-lg border border-default bg-elevated p-1 shadow-lg"
    role="toolbar"
    :aria-label="$t('articles.editor.image.toolbar')"
  >
    <TiptapImageDetails
      :alt="attrs.alt"
      :title="attrs.title"
      :href="attrs.href"
      :mediaId="attrs.mediaId"
      :linkable="isFigure"
      @submit="saveDetails"
    />
    <div class="flex min-w-0 items-center gap-1 overflow-x-auto">
      <USeparator orientation="vertical" class="h-6" />
      <UButton
        v-for="width in IMAGE_WIDTHS"
        :key="width"
        color="neutral"
        :variant="(attrs.displayWidth ?? 100) === width ? 'soft' : 'ghost'"
        size="sm"
        class="shrink-0 tabular-nums"
        :label="`${width} %`"
        :aria-label="$t('articles.editor.image.width', { width })"
        :aria-pressed="(attrs.displayWidth ?? 100) === width"
        @click="update({ displayWidth: width === 100 ? null : width })"
      />
      <USeparator orientation="vertical" class="h-6" />
      <UButton
        v-for="align in aligns"
        :key="align.value"
        :icon="align.icon"
        color="neutral"
        :variant="isAligned(align.value) ? 'soft' : 'ghost'"
        size="sm"
        class="shrink-0"
        :title="$t(align.label)"
        :aria-label="$t(align.label)"
        :aria-pressed="isAligned(align.value)"
        @click="setAlign(align.value)"
      />
      <USeparator orientation="vertical" class="h-6" />
      <UButton
        icon="mdi:image-refresh-outline"
        color="neutral"
        variant="ghost"
        size="sm"
        class="shrink-0"
        :title="$t('articles.editor.image.replace')"
        :aria-label="$t('articles.editor.image.replace')"
        @click="selected && emit('replace', selected.pos)"
      />
      <UButton
        icon="mdi:delete-outline"
        color="error"
        variant="ghost"
        size="sm"
        class="shrink-0"
        :title="$t('articles.editor.image.delete')"
        :aria-label="$t('articles.editor.image.delete')"
        @click="editor.chain().focus().deleteSelection().run()"
      />
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { FigureAlign } from '~~/shared/utils/articleFigure'
import type { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu'

import { NodeSelection } from '@tiptap/pm/state'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { IMAGE_WIDTHS } from '~~/shared/utils/articleFigure'

const { editor } = defineProps<{ editor: Editor }>()
const emit = defineEmits<{ replace: [pos: number] }>()

const { t } = useI18n()
const toast = useToast()

const IMAGE_NODES = ['figure', 'image']

const ALIGNS = [
  { value: 'left', icon: 'mdi:format-align-left', label: 'articles.editor.toolbar.alignLeft' },
  { value: 'center', icon: 'mdi:format-align-center', label: 'articles.editor.toolbar.alignCenter' },
  { value: 'right', icon: 'mdi:format-align-right', label: 'articles.editor.toolbar.alignRight' },
  { value: 'float-left', icon: 'mdi:format-float-left', label: 'articles.editor.image.floatLeft' },
  { value: 'float-right', icon: 'mdi:format-float-right', label: 'articles.editor.image.floatRight' },
] as const satisfies { value: FigureAlign; icon: string; label: string }[]

const shouldShow: NonNullable<BubbleMenuPluginProps['shouldShow']> = ({ editor, state }) =>
  editor.isEditable && state.selection instanceof NodeSelection && IMAGE_NODES.includes(state.selection.node.type.name)

const getBubbleContainer = () => editor.view.dom.parentElement?.parentElement ?? document.body

const selected = computed(() => {
  const { selection } = editor.state
  return selection instanceof NodeSelection && IMAGE_NODES.includes(selection.node.type.name)
    ? { node: selection.node, pos: selection.from }
    : null
})
const attrs = computed(() => selected.value?.node.attrs ?? {})
const isFigure = computed(() => selected.value?.node.type.name === 'figure')
// An inline image aligns through its paragraph and cannot float out of it.
const aligns = computed(() => (isFigure.value ? ALIGNS : ALIGNS.filter((align) => !align.value.startsWith('float'))))

const update = (patch: Record<string, unknown>) => {
  const target = selected.value
  if (!target) return
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, ...patch })
      tr.setSelection(NodeSelection.create(tr.doc, target.pos))
      return true
    })
    .run()
}

const isAligned = (align: FigureAlign) =>
  isFigure.value ? attrs.value.align === align : editor.isActive({ textAlign: align })

const setAlign = (align: FigureAlign) => {
  if (!isFigure.value) return editor.chain().focus().setTextAlign(align).run()
  // A full-width float has nothing to wrap text around.
  const floatWidth = align.startsWith('float') && !attrs.value.displayWidth ? { displayWidth: 50 } : {}
  update({ align, ...floatWidth })
}

const saveDetails = async (details: {
  alt: string
  title: string | null
  href: string | null
  saveDefault: boolean
}) => {
  const { mediaId } = attrs.value
  update({ alt: details.alt, title: details.title, ...(isFigure.value ? { href: details.href } : {}) })
  if (!details.saveDefault || !mediaId) return
  try {
    await $fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
      method: 'PATCH',
      body: { defaultAltText: details.alt || null },
    })
    toast.add({ color: 'success', title: t('articles.editor.image.defaultAltSaved') })
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('articles.editor.image.defaultAltFailed')) })
  }
}
</script>
