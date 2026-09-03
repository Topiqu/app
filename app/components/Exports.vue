<template>
  <UDropdownMenu v-if="articles.length" :items="exportItems">
    <UButton
      color="neutral"
      variant="soft"
      icon="mdi:export-variant"
      trailingIcon="mdi:chevron-down"
      :loading="exporting !== null"
      :disabled="exporting !== null"
    >
      {{ $t('articles.export.label') }}
    </UButton>
  </UDropdownMenu>

  <UModal v-model:open="showConfirm">
    <template #body>
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <AppMedia
            src="/topik_premysli_rm.png"
            :alt="$t('common.warning')"
            aspectRatio="1 / 1"
            fit="contain"
            sizes="56px"
            containerClass="size-14 rounded-full bg-transparent"
          />
        </div>
        <div class="flex-grow space-y-1.5">
          <h3 class="text-base font-medium text-highlighted">
            {{ $t(`articles.export.warning.title.${pendingType}`) }}
          </h3>
          <p class="text-sm text-muted leading-relaxed">
            {{ $t(`articles.export.warning.message.${pendingType}`, { count: articles.length }) }}
          </p>
          <UAlert
            color="warning"
            variant="soft"
            icon="mdi:clock-outline"
            :description="$t(`articles.export.warning.note.${pendingType}`)"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="cancelExport">{{ $t('common.actions.cancel') }}</UButton>
        <UButton @click="executeExport">{{ $t('common.actions.continue') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ArticleWithDetails } from '~~/types/article'

const { articles } = defineProps<{
  articles: ArticleWithDetails[]
}>()

const { exportJson, exportCsv, exportPdf } = useExport()

const showConfirm = shallowRef(false)
const pendingExport = shallowRef<(() => Promise<void>) | null>(null)
const pendingType = shallowRef<'json' | 'csv' | 'pdf' | null>(null)
const exporting = shallowRef<'json' | 'csv' | 'pdf' | null>(null)
const exportItems = computed(() => [
  {
    label: $t('articles.export.title.json'),
    icon: 'mdi:code-json',
    onSelect: () => handleExport(exportJson, 'json'),
  },
  {
    label: $t('articles.export.title.csv'),
    icon: 'mdi:file-delimited',
    onSelect: () => handleExport(exportCsv, 'csv'),
  },
  {
    label: $t('articles.export.title.pdf'),
    icon: 'mdi:file-pdf-box',
    onSelect: () => handleExport(exportPdf, 'pdf'),
  },
])

async function handleExport(fn: (data: ArticleWithDetails[]) => any, type: 'json' | 'csv' | 'pdf') {
  if (articles.length > 10) {
    pendingType.value = type
    pendingExport.value = () => executeWithLoading(fn, type)
    showConfirm.value = true
  } else {
    await executeWithLoading(fn, type)
  }
}

async function executeWithLoading(fn: (data: ArticleWithDetails[]) => any, type: 'json' | 'csv' | 'pdf') {
  exporting.value = type
  try {
    if (type === 'pdf') await fn(articles)
    else fn(articles)
  } finally {
    exporting.value = null
  }
}

function cancelExport() {
  pendingExport.value = null
  pendingType.value = null
  showConfirm.value = false
}

async function executeExport() {
  await pendingExport.value?.()
  pendingExport.value = null
  pendingType.value = null
  showConfirm.value = false
}
</script>
