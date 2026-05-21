<template>
  <div
    role="status"
    :aria-label="`${chars} / ${limit} ${$t('articles.editor.toolbar.characters')}`"
    :class="[
      'text-xs flex items-center gap-2',
      chars >= limit ? 'text-red-500' : chars >= warn ? 'text-orange-500' : 'text-green-500',
    ]"
  >
    <svg height="40" width="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle r="15" cx="20" cy="20" fill="#e9ecef" />
      <circle
        r="5"
        cx="20"
        cy="20"
        fill="transparent"
        stroke="currentColor"
        stroke-width="20"
        :stroke-dasharray="`${Math.min(percentage, 100) * 0.314} 31.4`"
        transform="rotate(-90) translate(-40)"
      />
      <circle r="6" cx="20" cy="20" fill="white" />
    </svg>
    <span class="hidden sm:block whitespace-nowrap">
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
const percentage = computed(() => Math.round((100 * chars.value) / limit))
</script>
