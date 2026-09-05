<template>
  <UButton
    data-color-mode
    :icon="icon"
    color="neutral"
    variant="ghost"
    square
    aria-label="Toggle color mode"
    @click="theme.toggle"
  />
</template>

<script setup lang="ts">
const theme = useThemeStore()
const hydrated = shallowRef(false)
const icon = computed(() =>
  hydrated.value ? (theme.isDark ? 'mdi:weather-sunny' : 'mdi:weather-night') : 'mdi:monitor',
)

onMounted(() => (hydrated.value = true))
</script>
