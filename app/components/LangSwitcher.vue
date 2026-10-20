<template>
  <UFormField :label="$t('profile.language')" :ui="{ label: 'sr-only' }">
    <USelectMenu v-model="language" valueKey="value" labelKey="label" :searchInput="false" :items>
      <template #leading><LanguageFlag :language /></template>
      <template #item-leading="{ item }"><LanguageFlag :language="item.value" /></template>
    </USelectMenu>
  </UFormField>
</template>

<script setup lang="ts">
const items = locales

const language = defineModel<Language>('language', { get: (value) => value || items[0]!.value, required: true })
</script>
