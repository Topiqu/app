<template>
  <form class="space-y-5" @submit.prevent="submit(selected)">
    <p class="text-sm leading-6 text-muted">{{ $t('common.websiteImport.reviewHelp') }}</p>
    <UAlert v-if="disabled" color="warning" :title="$t('common.websiteImport.saveFirst')" />
    <div class="divide-y divide-default rounded-(--topiqu-surface-radius) border border-default">
      <div v-for="field in fields" :key="field" class="space-y-3 p-4 sm:p-5" :data-website-field="field">
        <UCheckbox
          :modelValue="selected.includes(field)"
          :label="$t(`common.websiteImport.fields.${field}`)"
          :disabled="disabled || busy || !available.includes(field)"
          @update:modelValue="toggle(field, $event === true)"
        />
        <template v-if="hasWebsiteImportValue(field, job.result!.values, job.knowledge.length)">
          <template v-if="field === 'logoUrl' || field === 'faviconUrl'">
            <AppMedia
              :src="`/api/website-import/${job.id}/assets/${field}`"
              :alt="$t(`common.websiteImport.fields.${field}`)"
              aspectRatio="1 / 1"
              fit="contain"
              class="size-24 rounded-md border border-default"
            />
          </template>
          <div v-else-if="field === 'accentColor'" class="flex items-center gap-3">
            <span
              class="size-8 shrink-0 rounded-md border border-default"
              :style="{ backgroundColor: draft.accentColor ?? undefined }"
              aria-hidden="true"
            />
            <UInput
              :modelValue="draft.accentColor ?? undefined"
              :aria-label="$t('common.websiteImport.fields.accentColor')"
              maxlength="7"
              :disabled="disabled || busy"
              class="w-36"
              @update:modelValue="draft.accentColor = String($event || '') || null"
            />
          </div>
          <UInputTags
            v-else-if="field === 'keywords'"
            v-model="draft.keywords"
            :aria-label="$t('common.websiteImport.fields.keywords')"
            :disabled="disabled || busy"
            class="w-full"
          />
          <USelect
            v-else-if="field === 'language'"
            :modelValue="draft.language ?? undefined"
            :items="languageItems"
            :aria-label="$t('common.websiteImport.fields.language')"
            :disabled="disabled || busy"
            @update:modelValue="draft.language = $event ?? null"
          />
          <ul v-else-if="field === 'socials'" class="space-y-2">
            <li
              v-for="social in draft.socials"
              :key="social.platform"
              class="flex min-w-0 flex-wrap items-center gap-2"
            >
              <span class="text-xs text-muted">{{ social.platform }}</span>
              <UInput
                v-model="social.url"
                :aria-label="social.platform"
                :disabled="disabled || busy"
                class="min-w-0 flex-1"
              />
            </li>
          </ul>
          <ul v-else-if="field === 'knowledge'" class="space-y-2 text-sm">
            <li v-for="source in job.knowledge" :key="source.id" class="min-w-0">
              <span class="block break-words text-highlighted">{{ source.title }}</span>
              <span class="block break-all text-xs text-muted">{{ source.sourceUrl }}</span>
            </li>
          </ul>
          <UTextarea
            v-else
            :modelValue="draft[field] ?? ''"
            :aria-label="$t(`common.websiteImport.fields.${field}`)"
            :rows="2"
            autoresize
            :disabled="disabled || busy"
            class="w-full"
            @update:modelValue="draft[field] = $event || null"
          />
          <p v-if="currentText(field)" class="break-words text-xs leading-5 text-muted">
            {{ $t('common.websiteImport.current', { value: currentText(field) }) }}
          </p>
        </template>
        <p v-else class="text-sm text-muted">{{ $t('common.websiteImport.notFound') }}</p>
      </div>
    </div>
    <p v-if="job.knowledge.length" class="text-xs leading-5 text-muted">
      {{ $t('common.websiteImport.knowledgeConsent') }}
    </p>
    <p v-for="warning in job.result?.warnings ?? []" :key="warning" class="text-sm text-muted">
      {{ $t(`common.websiteImport.warnings.${warning}`) }}
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        type="button"
        :label="$t('common.websiteImport.allCorrect')"
        :disabled="disabled || !available.length"
        :loading="busy"
        @click="submit(available)"
      />
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        :label="$t('common.websiteImport.applySelected')"
        :disabled="disabled || !selected.length || busy"
      />
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :label="$t('common.websiteImport.skip')"
        :disabled="disabled || busy"
        @click="submit([])"
      />
    </div>
  </form>
</template>

<script setup lang="ts">
import type { WebsiteImportField, WebsiteImportView, WebsiteValues } from '~~/shared/utils/websiteImport'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { WEBSITE_IMPORT_FIELDS, hasWebsiteImportValue } from '~~/shared/utils/websiteImport'

const props = defineProps<{ job: WebsiteImportView; busy?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ apply: [fields: WebsiteImportField[], values: WebsiteValues] }>()
const draft = ref<WebsiteValues>(structuredClone(toRaw(props.job.result!.values)))
const selected = shallowRef<WebsiteImportField[]>([])
const can = useTenantScope()
const { t } = useI18n()
const fields = WEBSITE_IMPORT_FIELDS
const languageItems = computed(() => LANGUAGE_OPTIONS.map((value) => ({ value, label: t(`languages.${value}`) })))
const available = computed(() =>
  fields.filter(
    (field) =>
      hasWebsiteImportValue(field, draft.value, props.job.knowledge.length) &&
      (field !== 'socials' || can('INTEGRATION_CONTROL')),
  ),
)
const toggle = (field: WebsiteImportField, checked: boolean) => {
  selected.value = checked
    ? [...new Set([...selected.value, field])]
    : selected.value.filter((value) => value !== field)
}
const submit = (chosen: WebsiteImportField[]) =>
  emit(
    'apply',
    chosen.filter((field) => available.value.includes(field)),
    structuredClone(toRaw(draft.value)),
  )
const currentText = (field: WebsiteImportField) => {
  if (field === 'knowledge') return ''
  const value = props.job.current[field]
  if (JSON.stringify(value) === JSON.stringify(draft.value[field])) return ''
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item : item.url))
        .join(', ')
        .slice(0, 300)
    : (value?.slice(0, 300) ?? '')
}
</script>
