<template>
  <UModal
    v-model:open="open"
    :title="$t('common.preferences.guide.title')"
    :description="$t('common.preferences.guide.intro')"
    :ui="{ content: 'max-w-2xl', body: 'min-h-0 overflow-y-auto space-y-5', footer: 'justify-end' }"
  >
    <slot :open="openDialog" />

    <template #body>
      <ClientPreferencesGuideExamples />
      <ClientPreferencesGuidePreview
        :focus="props.focus"
        :audience="props.audience"
        :language="props.language"
        :keywords="props.keywords"
      />
    </template>

    <template #footer="{ close }">
      <UButton color="neutral" variant="soft" @click="close">{{ $t('common.close') }}</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    focus?: string
    audience?: string
    language?: string
    keywords?: string[]
  }>(),
  { focus: '', audience: '', language: 'en', keywords: () => [] },
)

const open = defineModel<boolean>({ default: false })
const openDialog = () => (open.value = true)
</script>
