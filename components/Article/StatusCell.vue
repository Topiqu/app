<template>
  <select
    class="border rounded px-2 py-1"
    :value="localStatus"
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

const localStatus = ref<ArticleStatus>(props.row.original.status)

function onChange(e: Event) {
  const newStatus = (e.target as HTMLSelectElement).value as ArticleStatus
  emit('update', props.row.original.id, newStatus)
}
</script>
