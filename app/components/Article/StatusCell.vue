<template>
  <div
    v-tippy="
      props.row.original.releaseAt
        ? `Plánováno na: ${format(new Date(props.row.original.releaseAt), 'dd.MM.yyyy, HH:mm')}`
        : ''
    "
    class="inline-flex items-center"
  >
    <select v-model="model" class="border rounded px-2 py-1">
      <option value="draft">Návrh</option>
      <option value="published">Publikováno</option>
    </select>
    <Icon v-if="props.row.original.releaseAt" name="mdi:hourglass" class="w-4 h-4 ml-2 text-blue-400" />
  </div>
</template>

<script setup lang="ts">
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'

import { format } from 'date-fns'
import { directive as vTippy } from 'vue-tippy'

const props = defineProps<{ row: { original: Article } }>()
const emit = defineEmits<{
  (e: 'update', id: string, newStatus: ArticleStatus): void
}>()

const model = computed({
  get: () => props.row.original.status,
  set: (val: ArticleStatus) => emit('update', props.row.original.id, val),
})
</script>
