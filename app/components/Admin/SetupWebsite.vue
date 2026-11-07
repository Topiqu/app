<template>
  <div class="space-y-3" data-setup-website>
    <p v-if="waiting" class="flex items-start gap-2 text-xs leading-5 text-muted">
      <UIcon
        name="mdi:loading"
        class="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>{{
        $t(
          job?.errorCode === 'DAILY_BUDGET'
            ? 'common.websiteImport.budgetWait'
            : 'common.setup.checklist.website.processing',
        )
      }}</span>
    </p>
    <template v-else-if="job?.status === 'READY' && job.result">
      <dl class="space-y-2 text-xs leading-5">
        <div v-for="row in summary" :key="row.field">
          <dt class="text-muted">{{ $t(`common.websiteImport.fields.${row.field}`) }}</dt>
          <dd class="line-clamp-3 text-highlighted [overflow-wrap:anywhere]">{{ row.value }}</dd>
        </div>
      </dl>
      <p v-if="job.knowledge.length" class="text-xs leading-5 text-muted">
        {{ $t('common.websiteImport.knowledgeConsent') }}
      </p>
      <p v-if="message" class="text-xs leading-5 text-error" role="alert">{{ message }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Settings may hold unsaved edits of the same fields; there the panel reviews them instead. -->
        <UButton
          v-if="!onSettings"
          size="sm"
          :label="$t('common.setup.checklist.website.accept')"
          :loading="busy"
          :disabled="!available.length"
          data-setup-website-accept
          @click="acceptAll"
        />
        <UButton
          size="sm"
          color="neutral"
          :variant="onSettings ? 'solid' : 'outline'"
          :to="reviewLink"
          :label="$t('common.setup.checklist.website.review')"
          @click="emit('navigate')"
        />
      </div>
    </template>
    <template v-else-if="data || error">
      <p v-if="job?.status === 'FAILED'" class="text-xs leading-5 text-muted">
        {{ $t('common.websiteImport.start.retryHelp') }}
      </p>
      <AdminSetupBrief v-if="withoutWebsite" />
      <WebsiteImportStart v-else :key="job?.id ?? 'new'" :initialUrl="job?.sourceUrl ?? data?.websiteUrl" />
      <UButton
        size="sm"
        color="neutral"
        variant="link"
        class="px-0"
        :label="
          $t(withoutWebsite ? 'common.setup.checklist.website.useWebsite' : 'common.setup.checklist.website.noWebsite')
        "
        data-setup-website-mode
        @click="withoutWebsite = !withoutWebsite"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ navigate: [] }>()
const { data, error, apply } = useWebsiteImport()
const can = useTenantScope()
const localePath = useLocalePath()
const route = useRoute()
const routeBaseName = useRouteBaseName()
const toast = useToast()
const { t } = useI18n()
const job = computed(() => data.value?.import)
const waiting = computed(() => !!job.value && ['PENDING', 'PROCESSING'].includes(job.value.status))
const onSettings = computed(() => routeBaseName(route) === 'settings')
const reviewLink = computed(() =>
  localePath({ name: 'settings', query: { tab: 'content', ...(job.value ? { websiteImport: job.value.id } : {}) } }),
)
const withoutWebsite = shallowRef(false)
const summary = computed(() => {
  const values = job.value?.result?.values
  if (!values) return []
  const rows = (['focus', 'audience', 'aiToneOfVoice'] as const)
    .filter((field) => values[field]?.trim())
    .map((field) => ({ field: field as WebsiteImportField, value: values[field]! }))
  const pages = job.value?.knowledge.length ?? 0
  return pages
    ? [...rows, { field: 'knowledge' as const, value: t('common.setup.checklist.website.sources', pages) }]
    : rows
})
// The same fields the review's "all correct" applies: social links need the integration scope.
const available = computed(() => {
  const current = job.value
  if (!current?.result) return []
  return WEBSITE_IMPORT_FIELDS.filter(
    (field) =>
      hasWebsiteImportValue(field, current.result!.values, current.knowledge.length) &&
      (field !== 'socials' || can('INTEGRATION_CONTROL')),
  )
})
const busy = shallowRef(false)
const message = shallowRef('')
const acceptAll = async () => {
  const values = job.value?.result?.values
  if (busy.value || !values) return
  busy.value = true
  message.value = ''
  try {
    await apply(available.value, structuredClone(toRaw(values)))
    toast.add({ color: 'success', title: t('common.websiteImport.applied') })
  } catch (failure) {
    message.value = websiteImportApplyMessage(failure, t)
  } finally {
    busy.value = false
  }
}
</script>
