<template>
  <NodeViewWrapper
    as="span"
    class="inline-block max-w-full align-bottom"
    :style="{ width: `${(preview === undefined ? node.attrs.displayWidth : preview) ?? 100}%` }"
  >
    <FileTiptapImageFrame
      v-model:preview="preview"
      :src="node.attrs.src"
      :alt="node.attrs.alt"
      :width="node.attrs.width"
      :height="node.attrs.height"
      :selected
      :editable
      @delete="deleteNode"
      @resize="(width) => updateAttributes({ displayWidth: width })"
    />
  </NodeViewWrapper>
</template>

<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const { deleteNode, updateAttributes } = props

const editable = useTiptapEditable(props.editor)
const preview = shallowRef<number | null>()
</script>
