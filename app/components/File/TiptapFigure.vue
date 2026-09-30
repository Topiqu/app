<template>
  <NodeViewWrapper
    as="figure"
    class="article-image"
    :data-align="node.attrs.align === 'center' ? undefined : node.attrs.align"
    :style="displayWidth ? { width: `${displayWidth}%` } : undefined"
  >
    <FileTiptapImageFrame
      v-model:preview="preview"
      :src="node.attrs.src"
      :alt="node.attrs.alt"
      :width="node.attrs.width"
      :height="node.attrs.height"
      :selected
      :editable
      :centered="node.attrs.align === 'center'"
      @delete="deleteNode"
      @resize="(width) => updateAttributes({ displayWidth: width })"
    />
    <div class="relative">
      <NodeViewContent />
      <span
        v-if="editable && !node.firstChild?.content.size"
        contenteditable="false"
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 top-0 pt-2 text-sm leading-6 text-dimmed"
        :class="captionAlign"
      >
        {{ $t('articles.editor.image.captionPlaceholder') }}
      </span>
    </div>
  </NodeViewWrapper>
</template>

<script lang="ts" setup>
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const { deleteNode, updateAttributes } = props

const editable = useTiptapEditable(props.editor)
const preview = shallowRef<number | null>()
const displayWidth = computed(() => (preview.value === undefined ? props.node.attrs.displayWidth : preview.value))
const captionAlign = computed(() => {
  const align = props.node.attrs.align as string
  return align.endsWith('left') ? 'text-left' : align.endsWith('right') ? 'text-right' : 'text-center'
})
</script>
