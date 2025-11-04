<template>
  <div
    v-tippy="
      props.row.original.releaseAt && new Date(props.row.original.releaseAt).getTime() - offset > Date.now()
        ? $t('articles.statusCell.scheduledTooltip', [
            format(new Date(props.row.original.releaseAt), 'dd.MM.yyyy, HH:mm'),
          ])
        : ''
    "
    class="inline-flex items-center"
  >
    <FormSelect :items="statusItems" v-model="model" :showValue="false" />
    <Icon
      v-if="props.row.original.releaseAt && new Date(props.row.original.releaseAt).getTime() - offset > Date.now()"
      name="mdi:hourglass"
      class="w-4 h-4 ml-2 text-blue-400"
    />
  </div>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleStatus } from '@zenstackhq/runtime/models'
import { format } from 'date-fns'
import { directive as vTippy } from 'vue-tippy'

const props = defineProps<{ row: { original: ArticleWithDetails } }>()
const emit = defineEmits<{
  (e: 'update', id: string, newStatus: ArticleStatus): void
}>()

const offset = new Date().getTimezoneOffset() * 60 * 1000

const statusItems = [
  { value: 'draft', label: $t('articles.status.draft'), icon: 'mdi:pencil-outline' },
  { value: 'published', label: $t('articles.status.published'), icon: 'mdi:earth' },
  { value: 'archived', label: $t('articles.status.archived'), icon: 'mdi:archive' },
]

const model = computed({
  get: () => props.row.original.status,
  set: (val: ArticleStatus) => emit('update', props.row.original.id, val),
})
</script>
