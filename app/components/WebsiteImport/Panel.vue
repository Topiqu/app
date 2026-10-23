<template>
  <section
    v-if="enabled && job"
    class="space-y-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 sm:p-6"
    data-website-import-panel
  >
    <header>
      <h2 class="text-lg font-semibold text-highlighted">{{ $t('common.websiteImport.title') }}</h2>
      <p class="mt-1 text-sm leading-6 text-muted">{{ $t('common.websiteImport.description') }}</p>
    </header>
    <UAlert
      v-if="error"
      color="error"
      :title="$t('common.messages.loadFailedTitle')"
      :actions="[{ label: $t('common.messages.retry'), onClick: () => refresh() }]"
    />
    <UAlert v-if="message" color="error" :title="message" />
    <WebsiteImportReview
      v-if="job?.status === 'READY' && job.result"
      :key="job.id"
      :job="job"
      :busy="busy"
      :disabled="disabled"
      @apply="applySelection"
    />
    <UAlert
      v-else-if="job && ['PENDING', 'PROCESSING'].includes(job.status)"
      color="neutral"
      icon="mdi:web-sync"
      :title="$t(`common.websiteImport.status.${job.status}`)"
      :description="
        $t(job.errorCode === 'DAILY_BUDGET' ? 'common.websiteImport.budgetWait' : 'common.websiteImport.background')
      "
    />
    <template v-else>
      <UAlert
        v-if="job?.status === 'REVIEWED'"
        color="success"
        icon="mdi:check-circle-outline"
        :title="$t('common.websiteImport.status.REVIEWED')"
      />
      <UAlert
        v-if="job?.status === 'FAILED'"
        color="warning"
        :title="$t('common.websiteImport.status.FAILED')"
        :description="$t('common.websiteImport.failedHelp')"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { WebsiteImportField, WebsiteValues } from '~~/shared/utils/websiteImport'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ applied: [] }>()
const { data, error, enabled, refresh, apply } = useWebsiteImport()
const job = computed(() => data.value?.import)
const busy = shallowRef(false)
const message = shallowRef('')
const { t } = useI18n()
const toast = useToast()
const failure = (error: unknown) => {
  const detail = error as {
    data?: { data?: { code?: string; field?: string }; statusCode?: number }
    statusCode?: number
  }
  const code = detail.data?.data?.code
  if (code === 'WEBSITE_CONFLICT') return t('common.websiteImport.conflict')
  if (code === 'WEBSITE_ASSET') return t('common.websiteImport.assetFailed')
  if (detail.statusCode === 429 || detail.data?.statusCode === 429) return t('common.websiteImport.rateLimited')
  return t('common.websiteImport.failedHelp')
}
const applySelection = async (fields: WebsiteImportField[], values: WebsiteValues) => {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    await apply(fields, values)
    toast.add({ color: 'success', title: t('common.websiteImport.applied') })
    emit('applied')
  } catch (error) {
    message.value = failure(error)
  } finally {
    busy.value = false
  }
}
</script>
