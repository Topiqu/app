<template>
  <div v-if="articles.length" class="flex justify-end gap-2 mb-4">
    <Button
      :title="$t('articles.export.title.json')"
      icon="mdi:code-json"
      size="sm"
      :loading="exporting === 'json'"
      :disabled="exporting !== null"
      animation="softpop"
      @click="handleExport(exportJson, 'json')"
    />
    <Button
      :title="$t('articles.export.title.csv')"
      icon="mdi:file-delimited"
      size="sm"
      :loading="exporting === 'csv'"
      :disabled="exporting !== null"
      animation="softpop"
      @click="handleExport(exportCsv, 'csv')"
    />
    <Button
      :title="$t('articles.export.title.pdf')"
      icon="mdi:file-pdf-box"
      size="sm"
      :loading="exporting === 'pdf'"
      :disabled="exporting !== null"
      animation="softpop"
      @click="handleExport(exportPdf, 'pdf')"
    />
  </div>

  <ModalMini
    v-model:open="showConfirm"
    :confirmText="$t('common.actions.continue')"
    :cancelText="$t('common.actions.cancel')"
    @confirm="executeExport"
    @cancel="cancelExport"
  >
    <template #content>
      <div class="flex items-start gap-4">
        <div class="flex-shrink-0">
          <NuxtImg
            src="/topik_premysli_rm.png"
            :alt="$t('common.warning')"
            width="56"
            height="56"
            class="rounded-full"
          />
        </div>
        <div class="flex-grow space-y-1.5">
          <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">
            {{ $t(`articles.export.warning.title.${pendingType}`) }}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {{ $t(`articles.export.warning.message.${pendingType}`, { count: articles.length }) }}
          </p>
          <p class="text-xs text-amber-500/70 dark:text-amber-400/70 flex items-center gap-1 opacity-70">
            <Icon name="mdi:clock-outline" class="w-3 h-3" />
            {{ $t(`articles.export.warning.note.${pendingType}`) }}
          </p>
        </div>
      </div>
    </template>
  </ModalMini>
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
