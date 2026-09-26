<template>
  <UModal v-model:open="open" :title="$t('knowledge.addTitle')" :description="$t('knowledge.addDescription')">
    <template #body>
      <form id="knowledge-add" class="flex flex-col gap-4" @submit.prevent="submit">
        <UTabs v-model="kind" :items="kindTabs" :content="false" class="w-full" />

        <template v-if="kind === 'NOTE'">
          <UFormField :label="$t('knowledge.fields.title')" required>
            <UInput v-model="form.title" class="w-full" maxlength="200" required />
          </UFormField>
          <UFormField :label="$t('knowledge.fields.note')" :hint="$t('knowledge.fields.noteHint')" required>
            <UTextarea v-model="form.text" class="w-full" :rows="8" autoresize :maxrows="16" required />
          </UFormField>
        </template>
        <template v-else-if="kind === 'FILE'">
          <UFileUpload
            v-model="file"
            accept=".pdf,.docx,.txt,.md"
            icon="mdi:file-upload-outline"
            :label="$t('knowledge.fields.file')"
            :aria-label="$t('knowledge.fields.file')"
            :description="$t('knowledge.fields.fileHint', { size: maxSize })"
            :preview="false"
            class="min-h-36 w-full"
          />
          <UFormField :label="$t('knowledge.fields.title')" :hint="$t('knowledge.fields.optional')">
            <UInput v-model="form.title" class="w-full" maxlength="200" />
          </UFormField>
        </template>
        <template v-else-if="kind === 'SITEMAP'">
          <UFormField
            :label="$t('knowledge.fields.sitemap')"
            :hint="$t('knowledge.fields.sitemapHint', { count: KNOWLEDGE_LIMITS.maxSitemapPages })"
            required
          >
            <UInput v-model="form.url" type="url" class="w-full" placeholder="https://" required :disabled="saving" />
          </UFormField>
          <div v-if="discovered" class="rounded-md border border-default bg-elevated/40 p-3 text-sm" aria-live="polite">
            <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
              <dt class="text-muted">{{ $t('knowledge.sitemap.found') }}</dt>
              <dd class="text-right font-semibold tabular-nums">{{ discovered.found }}</dd>
              <dt class="text-muted">{{ $t('knowledge.sitemap.existing') }}</dt>
              <dd class="text-right font-semibold tabular-nums">{{ discovered.existing }}</dd>
              <dt class="text-muted">{{ $t('knowledge.sitemap.offered') }}</dt>
              <dd class="text-right font-semibold tabular-nums text-highlighted">{{ discovered.urls.length }}</dd>
            </dl>
            <p v-if="sitemapCapNote" class="mt-2 text-xs text-muted">{{ sitemapCapNote }}</p>
          </div>
          <div v-if="progress" class="flex flex-col gap-1.5" aria-live="polite">
            <UProgress :modelValue="progress.done" :max="progress.total" />
            <p class="text-xs text-muted">{{ $t('knowledge.sitemapProgress', progress) }}</p>
          </div>
        </template>
        <template v-else>
          <UFormField :label="$t('knowledge.fields.url')" :hint="$t('knowledge.fields.urlHint')" required>
            <UInput v-model="form.url" type="url" class="w-full" placeholder="https://" required />
          </UFormField>
          <UFormField :label="$t('knowledge.fields.title')" :hint="$t('knowledge.fields.optional')">
            <UInput v-model="form.title" class="w-full" maxlength="200" />
          </UFormField>
        </template>

        <UFormField :label="$t('knowledge.fields.validAsOf')" :hint="$t('knowledge.fields.validAsOfAddHint')">
          <UInput v-model="form.validAsOf" type="date" class="w-full" :max="today" />
        </UFormField>

        <USwitch
          v-model="form.isPublic"
          :label="$t('knowledge.public')"
          :aria-label="$t('knowledge.public')"
          :description="$t('knowledge.publicHint')"
        />
        <UFormField
          v-if="form.isPublic && (kind === 'NOTE' || kind === 'FILE')"
          :label="$t('knowledge.fields.publicUrl')"
          required
        >
          <UInput v-model="form.publicUrl" type="url" class="w-full" placeholder="https://" required />
        </UFormField>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="mdi:information-outline"
          :title="$t('knowledge.consent.title')"
          :description="`${$t(form.isPublic ? 'knowledge.consent.usePublic' : 'knowledge.consent.useInternal')} ${$t('knowledge.consent.processing')}`"
        />
        <UFormField name="confirmed">
          <UCheckbox v-model="form.confirmed" required :label="$t('knowledge.consent.confirm')" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('knowledge.cancel') }}</UButton>
        <UButton
          type="submit"
          form="knowledge-add"
          :loading="saving"
          :disabled="!form.confirmed || (kind === 'FILE' && !file)"
        >
          {{ submitLabel }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { KNOWLEDGE_LIMITS } from '~~/shared/utils/knowledge'

const emit = defineEmits<{ created: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useAppToast()

type Kind = 'NOTE' | 'FILE' | 'URL' | 'SITEMAP'
const kind = shallowRef<Kind>('NOTE')
const kindTabs = computed(() =>
  (['NOTE', 'FILE', 'URL', 'SITEMAP'] as const).map((value) => ({ value, label: t(`knowledge.kinds.${value}`) })),
)
const progress = shallowRef<{ done: number; total: number } | null>(null)
type Discovery = { urls: string[]; found: number; existing: number; quotaLeft: number }
const discovered = shallowRef<Discovery | null>(null)
const file = shallowRef<File | null>(null)
const saving = shallowRef(false)
const blank = () => ({ title: '', text: '', url: '', publicUrl: '', validAsOf: '', isPublic: false, confirmed: false })
const today = new Date().toISOString().slice(0, 10)
const form = reactive(blank())
const maxSize = `${KNOWLEDGE_LIMITS.maxFileBytes / 1024 / 1024} MB`

watch(open, (value) => {
  if (value) return
  Object.assign(form, blank())
  file.value = null
  kind.value = 'NOTE'
  progress.value = null
  discovered.value = null
})
watch([kind, () => form.url], () => (discovered.value = null))

// The offer is capped, so say why it is smaller than the sitemap: otherwise 50 of 392 reads as
// a 50-page sitemap.
const sitemapCapNote = computed(() => {
  const found = discovered.value
  if (!found || found.urls.length >= found.found - found.existing) return null
  return found.quotaLeft < KNOWLEDGE_LIMITS.maxSitemapPages
    ? t('knowledge.sitemap.cappedByQuota', { count: found.quotaLeft })
    : t('knowledge.sitemap.cappedByBatch', { count: KNOWLEDGE_LIMITS.maxSitemapPages })
})
const submitLabel = computed(() => {
  if (kind.value !== 'SITEMAP') return t('knowledge.add')
  return discovered.value?.urls.length
    ? t('knowledge.sitemap.import', { count: discovered.value.urls.length })
    : t('knowledge.sitemap.discover')
})

const errorMessage = (cause: any) => {
  const code = cause?.data?.data?.code
  return code === 'KNOWLEDGE_DUPLICATE'
    ? t('knowledge.errors.duplicate')
    : code === 'KNOWLEDGE_QUOTA'
      ? t('knowledge.errors.quota')
      : cause?.data?.message || t('knowledge.actionError')
}

const pageForm = (url: string) => {
  const body = new FormData()
  body.set('kind', 'URL')
  body.set('url', url)
  body.set('isPublic', String(form.isPublic))
  body.set('confirmed', String(form.confirmed))
  if (form.validAsOf) body.set('validAsOf', form.validAsOf)
  return body
}

// Pages go through the regular URL endpoint two at a time, gentle on the site and on the
// per-tenant rate limit; a full quota or the rate limit ends the import early.
const discoverSitemap = () => $fetch('/api/knowledge/sitemap', { method: 'POST', body: { url: form.url.trim() } })

const importSitemap = async (urls: string[]) => {
  const queue = [...urls]
  let added = 0
  let stopped = false
  progress.value = { done: 0, total: urls.length }
  const worker = async () => {
    while (queue.length && !stopped) {
      try {
        await $fetch('/api/knowledge', { method: 'POST', body: pageForm(queue.shift()!) })
        added += 1
      } catch (cause: any) {
        if (cause?.data?.data?.code === 'KNOWLEDGE_QUOTA' || cause?.statusCode === 429) stopped = true
      }
      progress.value = { done: progress.value!.done + 1, total: urls.length }
    }
  }
  await Promise.all([worker(), worker()])
  toast.success({ message: t('knowledge.sitemapImported', { added, skipped: urls.length - added }) })
  open.value = false
  emit('created')
}

const submit = async () => {
  if (kind.value === 'SITEMAP') {
    saving.value = true
    try {
      if (discovered.value?.urls.length) await importSitemap(discovered.value.urls)
      else {
        const found = await discoverSitemap()
        discovered.value = found
        if (!found.urls.length) toast.error({ message: t('knowledge.errors.sitemapEmpty') })
      }
    } catch (cause: any) {
      toast.error({ message: errorMessage(cause) })
    } finally {
      saving.value = false
    }
    return
  }
  const body = new FormData()
  body.set('kind', kind.value)
  body.set('isPublic', String(form.isPublic))
  body.set('confirmed', String(form.confirmed))
  if (form.title.trim()) body.set('title', form.title.trim())
  if (form.validAsOf) body.set('validAsOf', form.validAsOf)
  if (kind.value === 'NOTE') body.set('text', form.text)
  if (kind.value === 'URL') body.set('url', form.url.trim())
  if (kind.value === 'FILE' && file.value) body.set('file', file.value)
  if (form.isPublic && kind.value !== 'URL') body.set('publicUrl', form.publicUrl.trim())

  saving.value = true
  try {
    await $fetch('/api/knowledge', { method: 'POST', body })
    toast.success({ message: t('knowledge.added') })
    open.value = false
    emit('created')
  } catch (cause: any) {
    toast.error({ message: errorMessage(cause) })
  } finally {
    saving.value = false
  }
}
</script>
