<template>
  <NuxtTime :datetime :locale v-bind="attrs" />
</template>

<script setup lang="ts">
const { datetime, preset = 'datetime' } = defineProps<{
  datetime: Date | string | number
  preset?: TimePreset
}>()

const { locale } = useI18n()

const attrs = computed(() => (preset === 'relative' ? { relative: true } : TIME_PRESETS[preset]))
</script>
