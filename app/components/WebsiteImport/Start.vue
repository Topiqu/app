<template>
  <form class="space-y-3" data-website-import-start @submit.prevent="submit">
    <UFormField :label="$t('common.websiteImport.start.label')" name="websiteUrl" :error="message || undefined">
      <UInput
        v-model="url"
        class="w-full"
        icon="mdi:earth"
        inputmode="url"
        autocomplete="url"
        autocapitalize="off"
        :spellcheck="false"
        maxlength="2048"
        :placeholder="$t('common.websiteImport.start.placeholder')"
        :disabled="busy"
      />
    </UFormField>
    <UCheckbox v-model="consent" :label="$t('common.websiteImport.start.consent')" :disabled="busy" />
    <UButton
      type="submit"
      icon="mdi:web-sync"
      :label="$t('common.websiteImport.start.submit')"
      :loading="busy"
      :disabled="!url.trim() || !consent"
    />
  </form>
</template>

<script setup lang="ts">
const { initialUrl } = defineProps<{ initialUrl?: string | null }>()
const { start } = useWebsiteImport()
const { t } = useI18n()
const url = shallowRef(initialUrl ?? '')
const consent = shallowRef(false)
const busy = shallowRef(false)
const message = shallowRef('')
let disposed = false
onScopeDispose(() => {
  disposed = true
})
const failure = (error: unknown) => {
  const detail = error as { data?: { data?: { code?: string }; statusCode?: number }; statusCode?: number }
  const code = detail.data?.data?.code
  if (code === 'WEBSITE_URL') return t('common.websiteImport.start.invalidUrl')
  if (code === 'WEBSITE_IMPORT_ACTIVE') return t('common.websiteImport.start.active')
  if (code === 'WEBSITE_IMPORT_LIMIT') return t('common.websiteImport.start.limit')
  if (code === 'AI_PLAN_REQUIRED') return t('common.websiteImport.start.aiPlanRequired')
  if (code === 'AI_ALLOWANCE_EXHAUSTED') return t('common.websiteImport.start.allowanceExhausted')
  if ((detail.statusCode ?? detail.data?.statusCode) === 429) return t('common.websiteImport.rateLimited')
  return t('common.websiteImport.start.failed')
}
const submit = async () => {
  if (busy.value || !consent.value) return
  const value = url.value.trim()
  if (!normalizeWebsiteUrl(value)) {
    message.value = t('common.websiteImport.start.invalidUrl')
    return
  }
  busy.value = true
  message.value = ''
  try {
    await start(value)
  } catch (error) {
    if (!disposed) message.value = failure(error)
  } finally {
    if (!disposed) busy.value = false
  }
}
</script>
