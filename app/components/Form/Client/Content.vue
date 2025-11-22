<template>
  <div class="flex flex-col gap-6">
    <FormField
      v-if="plan !== 'BASIC'"
      v-model="focus"
      :label="$t('common.preferences.focus.label')"
      :placeholder="$t('common.preferences.focus.placeholder')"
    />

    <FormField
      v-if="plan !== 'BASIC'"
      v-model="audience"
      :label="$t('common.preferences.audience.label')"
      :placeholder="$t('common.preferences.audience.placeholder')"
    />

    <div v-if="plan !== 'BASIC'" class="flex flex-col gap-2">
      <FormLabel :text="$t('common.preferences.language.label')" />
      <FormSelect v-model="language" :items="languageItems" />
    </div>

    <div v-if="plan !== 'BASIC'" class="flex flex-col gap-2">
      <FormLabel :text="$t('common.preferences.keywords.label')" />
      <FormField
        v-model="keywordsInput"
        :placeholder="$t('common.preferences.keywords.placeholder')"
        @input="updateKeywords"
      />
      <span class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {{ $t('common.preferences.keywords.count', [keywords.length]) }}
      </span>
    </div>
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
  get: () => props.language,
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
