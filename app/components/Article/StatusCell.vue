<template>
  <UTooltip :text="tooltip" :disabled="!tooltip">
    <div class="flex min-w-0 items-center">
      <UFormField class="min-w-0 flex-1" :label="$t('articles.columns.status')" :ui="{ label: 'sr-only' }">
        <USelectMenu
          v-model="model"
          valueKey="value"
          labelKey="label"
          :searchInput="false"
          :items="statusItems"
          class="min-w-0 flex-1"
          :ui="{ base: 'w-full min-w-0', content: 'min-w-48' }"
        />
      </UFormField>
      <UIcon
        v-if="props.row.original.releaseAt && new Date(props.row.original.releaseAt).getTime() - offset > Date.now()"
        name="mdi:hourglass"
        size="16"
        class="ml-2 text-info"
      />
    </div>
  </UTooltip>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleStatus } from '@zenstackhq/runtime/models'

import { format } from 'date-fns'

const props = defineProps<{ row: { original: ArticleWithDetails } }>()
const emit = defineEmits<{
  (e: 'update', id: string, newStatus: ArticleStatus): void
}>()

const offset = new Date().getTimezoneOffset() * 60 * 1000
const tooltip = computed(() =>
  props.row.original.releaseAt && new Date(props.row.original.releaseAt).getTime() - offset > Date.now()
    ? $t('articles.statusCell.scheduledTooltip', [format(new Date(props.row.original.releaseAt), 'dd.MM.yyyy, HH:mm')])
    : '',
)

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
