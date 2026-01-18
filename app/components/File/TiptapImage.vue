<template>
  <NodeViewWrapper class="inline-block relative leading-none select-none max-w-full w-full group">
    <Button
      square
      size="sm"
      variant="danger"
      icon="mdi:close"
      class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      :title="$t('common.close')"
      @click.stop.prevent="deleteNode"
      @mousedown.stop.prevent
    />

    <Transition
      enterActiveClass="transition-opacity duration-300 ease-out"
      enterFromClass="opacity-0"
      enterToClass="opacity-100"
      leaveActiveClass="transition-opacity duration-300 ease-in"
      leaveFromClass="opacity-100"
      leaveToClass="opacity-0"
    >
      <div
        v-if="isRetrying"
        class="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg z-10 flex items-center justify-center border border-gray-200 dark:border-gray-700"
      >
        <div class="flex flex-col items-center gap-2">
          <Icon name="mdi:image-filter-hdr" class="text-gray-400 w-10 h-10 opacity-50" />
          <span class="text-xs text-gray-400 font-medium animate-pulse">{{ $t('common.loading') }}</span>
        </div>
      </div>
    </Transition>

    <NuxtImg
      v-if="currentSrc"
      :src="currentSrc"
      :alt="node.attrs.alt"
      :title="node.attrs.title"
      class="rounded-lg transition-all duration-200 max-w-full h-auto object-cover"
      :class="{
        'ring-2 ring-blue-500': selected,
        'opacity-0': isRetrying,
        'min-h-[16rem] w-full bg-gray-50': isRetrying,
      }"
      @error="handleError"
      @load="handleLoad"
    />

    <div
      v-else
      class="w-full h-64 bg-red-50 flex flex-col gap-2 items-center justify-center text-red-500 text-sm rounded-lg border border-red-200 p-4"
    >
      <Icon name="mdi:image-broken-variant" class="w-8 h-8" />
      <span>{{ $t('common.error') }}</span>
    </div>
  </NodeViewWrapper>
</template>

<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

const props = defineProps(nodeViewProps)

const { deleteNode } = props

const { currentSrc, isRetrying, handleError, handleLoad } = useImageRetry(() => props.node.attrs.src)
</script>
