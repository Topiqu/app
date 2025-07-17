<template>
  <select v-model="status" class="border rounded px-2 py-1" @change="onChange">
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

const status = ref(props.row.original.status)

function onChange() {
  emit('update', props.row.original.id, status.value as ArticleStatus)
}
</script>
