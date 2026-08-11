<template>
  <div class="flex flex-col gap-6">
    <UFormField v-if="plan !== 'BASIC'" :label="$t('common.preferences.focus.label')">
      <UInput v-model="focus" :placeholder="$t('common.preferences.focus.placeholder')" />
    </UFormField>

    <UFormField v-if="plan !== 'BASIC'" :label="$t('common.preferences.audience.label')">
      <UInput v-model="audience" :placeholder="$t('common.preferences.audience.placeholder')" />
    </UFormField>

    <UFormField v-if="plan !== 'BASIC'" :label="$t('common.preferences.language.label')">
      <USelectMenu v-model="language" valueKey="value" labelKey="label" :searchInput="false" :items="languageItems" />
    </UFormField>

    <UFormField
      v-if="plan !== 'BASIC'"
      :label="$t('common.preferences.keywords.label')"
      :description="$t('common.preferences.keywords.count', [keywords.length])"
    >
      <UInput
        v-model="keywordsInput"
        :placeholder="$t('common.preferences.keywords.placeholder')"
        @input="updateKeywords"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { LanguageSchema } from '~~/shared/zod/enums'

const props = defineProps<{
  plan: string
  focus: string
  audience: string
  language: string
  keywords: string[]
}>()

const emit = defineEmits<{
  'update:focus': [string]
  'update:audience': [string]
  'update:language': [string]
  'update:keywords': [string[]]
}>()

const focus = computed({
  get: () => props.focus,
  set: (v) => emit('update:focus', v),
})

const audience = computed({
  get: () => props.audience,
  set: (v) => emit('update:audience', v),
})

const language = computed({
  get: () => props.language as 'cs' | 'en',
  set: (v) => emit('update:language', v),
})

const languageItems = LanguageSchema.options.map((lang) => ({
  value: lang,
  label: $t(`languages.${lang}`),
}))

const keywordsInput = shallowRef('')

watch(
  () => props.keywords,
  (val) => {
    keywordsInput.value = val.join(', ')
  },
  { immediate: true },
)

const updateKeywords = useDebounceFn(() => {
  const arr = keywordsInput.value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  emit('update:keywords', arr)
}, 1500)
</script>
