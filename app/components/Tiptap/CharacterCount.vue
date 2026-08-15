<template>
  <div class="flex min-w-36 items-center gap-2 text-xs" role="status">
    <UProgress :modelValue="percentage" :max="100" :color="progressColor" size="sm" class="flex-1" />
    <span class="whitespace-nowrap">
      {{ chars }} / {{ limit }}<br />
      {{ words }} {{ $t('articles.editor.toolbar.words') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

const { editor, limit } = defineProps<{ editor: Editor; limit: number }>()

const chars = computed(() => editor.storage.characterCount.characters())
const words = computed(() => editor.storage.characterCount.words())
const warn = computed(() => Math.floor(limit * 0.9))
const percentage = computed(() => Math.min(100, Math.round((100 * chars.value) / limit)))
const progressColor = computed(() =>
  chars.value >= limit ? 'error' : chars.value >= warn.value ? 'warning' : 'success',
)
</script>
