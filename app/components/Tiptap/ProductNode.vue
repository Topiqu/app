<template>
  <NodeViewWrapper
    class="not-prose group my-6 flex items-center gap-3 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 shadow-sm"
    contenteditable="false"
    data-drag-handle
  >
    <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <UIcon name="mdi:shopping-outline" class="size-5" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-xs text-muted">{{ $t('articles.editor.productPicker.card') }}</span>
      <span class="truncate font-semibold text-highlighted">{{ node.attrs.name }}</span>
      <span class="truncate text-xs text-muted">{{ node.attrs.url }}</span>
    </span>
    <UButton
      v-if="editable"
      square
      size="sm"
      color="error"
      variant="ghost"
      icon="i-mdi-trash-can-outline"
      class="shrink-0 opacity-70 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      :aria-label="$t('common.delete')"
      :title="$t('common.delete')"
      @click.stop.prevent="deleteNode"
      @mousedown.stop.prevent
    />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)
const { deleteNode } = props
const editable = useTiptapEditable(props.editor)
</script>
