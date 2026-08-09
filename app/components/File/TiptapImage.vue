<template>
  <NodeViewWrapper class="inline-block relative leading-none select-none max-w-full w-full group">
    <UButton
      square
      size="sm"
      color="error"
      variant="solid"
      icon="i-mdi-close"
      class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      :title="$t('common.close')"
      @click.stop.prevent="deleteNode"
      @mousedown.stop.prevent
    />

    <AppMedia
      :src="node.attrs.src"
      :alt="node.attrs.alt"
      aspectRatio="16 / 9"
      sizes="100vw lg:760px"
      :containerClass="['w-full rounded-lg', selected ? 'ring-2 ring-primary' : ''].join(' ')"
    />
  </NodeViewWrapper>
</template>

<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const { deleteNode } = props
</script>
