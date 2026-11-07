<template>
  <section
    v-if="enabled && (job || pending || error || (canStart && data))"
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
    <USkeleton v-if="pending && !job" class="h-20 w-full" />
    <WebsiteImportReview
      v-if="job?.status === 'READY' && job.result"
      :key="job.id"
      :job="job"
      :busy="busy"
      :disabled="disabled"
      @apply="applySelection"
    />
    <template v-else-if="job && ['PENDING', 'PROCESSING'].includes(job.status)">
      <UAlert
        color="neutral"
        icon="mdi:web-sync"
        :title="$t(`common.websiteImport.status.${job.status}`)"
        :description="$t(reason ?? 'common.websiteImport.background')"
      />
      <WebsiteImportProgress v-if="job.progress" :job />
    </template>
    <template v-else>
      <UAlert
        v-if="job?.status === 'REVIEWED'"
        color="success"
        icon="mdi:check-circle-outline"
        :title="$t('common.websiteImport.status.REVIEWED')"
        :actions="
          canStart && !restarting
            ? [
                {
                  label: $t('common.websiteImport.start.again'),
                  color: 'neutral',
                  variant: 'outline',
                  onClick: () => (restarting = true),
                },
              ]
            : undefined
        "
      />
      <div v-if="job?.status === 'REVIEWED' && firstArticle" class="space-y-2" data-website-import-next>
        <p class="text-sm font-medium text-highlighted">{{ $t('common.setup.checklist.steps.draft.title') }}</p>
        <WebsiteImportTopics />
        <UButton
          size="sm"
          icon="mdi:auto-fix"
          :to="localePath({ name: 'admin-editor-id', params: { id: 'new' }, query: { ai: '1' } })"
          :label="
            $t(
              topics.length
                ? 'common.setup.checklist.steps.draft.ownTopic'
                : 'common.setup.checklist.steps.draft.action',
            )
          "
        />
      </div>
      <UAlert
        v-if="job?.status === 'FAILED'"
        color="warning"
        :title="$t('common.websiteImport.status.FAILED')"
        :description="
          $t(reason ?? (canStart ? 'common.websiteImport.start.retryHelp' : 'common.websiteImport.failedHelp'))
        "
      />
      <WebsiteImportProgress v-if="job?.status === 'FAILED' && job.progress" :job />
      <WebsiteImportStart
        v-if="canStart && data && (!job || job.status === 'FAILED' || restarting)"
        :key="job?.id ?? 'new'"
        :initialUrl="job?.sourceUrl ?? data?.websiteUrl"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ applied: [] }>()
const { data, pending, error, enabled, refresh, apply } = useWebsiteImport()
const { data: status } = useClientSiteStatus()
const job = computed(() => data.value?.import)
const reason = computed(() => (job.value ? websiteImportReason(job.value) : null))
const canStart = computed(() => hasAiPlan(status.value?.plan))
const can = useTenantScope()
const localePath = useLocalePath()
const topics = useWebsiteTopics()
// Reviewing is where the settings work ends, so the next step is the first article, not more settings.
const firstArticle = computed(
  () => canStart.value && status.value?.setup?.hasDraft === false && can('AI_USE') && can('ARTICLE_WRITE'),
)
const restarting = shallowRef(false)
watch(
  () => job.value?.id,
  () => {
    restarting.value = false
  },
)
const busy = shallowRef(false)
const message = shallowRef('')
const { t } = useI18n()
const toast = useToast()
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const applySelection = async (fields: WebsiteImportField[], values: WebsiteValues) => {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    await apply(fields, values)
    if (disposed) return
    toast.add({ color: 'success', title: t('common.websiteImport.applied') })
    emit('applied')
  } catch (error) {
    if (!disposed) message.value = websiteImportApplyMessage(error, t)
  } finally {
    if (!disposed) busy.value = false
  }
}
</script>
