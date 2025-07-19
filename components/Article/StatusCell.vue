<template>
  <select
    :value="props.row.original.status"
    class="border rounded px-2 py-1"
    @change="onChange"
  >
    <option value="draft">Návrh</option>
    <option value="published">Publikováno</option>
  </select>
</template>

<script setup lang="ts">
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'

const props = defineProps<{ row: { original: Article } }>()
const emit = defineEmits<{
  (e: 'update', id: string, newStatus: ArticleStatus): void
}>()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as ArticleStatus
  emit('update', props.row.original.id, value)
}
</script>
