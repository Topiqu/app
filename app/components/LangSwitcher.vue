<template>
  <FormSelect v-model="language" :items />
</template>

<script setup lang="ts">
const items = locales

const language = defineModel<Language>({ get: (value) => value || items[0]!.value, required: true })
</script>
