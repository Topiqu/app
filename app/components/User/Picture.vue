<template>
  <AppMedia
    :src="url"
    :alt="(name || '') + ' ' + $t('common.avatar.alt.profile')"
    :fallbackText="name || undefined"
    fallbackIcon="mdi:account-circle-outline"
    aspectRatio="1 / 1"
    :sizes="pixelSize"
    :containerClass="`${sizeClass} shrink-0 rounded-full`"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  url?: string | null
  size?: 'mn' | 'sm' | 'md' | 'lg' | 'hg' | 'xl'
  name?: string | null
}>()

const sizeClass = computed(() => {
  switch (props.size) {
    case 'mn':
      return 'size-6'
    case 'sm':
      return 'size-8'
    case 'lg':
      return 'size-12'
    case 'hg':
      return 'size-16'
    case 'xl':
      return 'size-24'
    default:
      return 'size-10'
  }
})
const pixelSize = computed(() => {
  switch (props.size) {
    case 'mn':
      return '24px'
    case 'sm':
      return '32px'
    case 'lg':
      return '48px'
    case 'hg':
      return '64px'
    case 'xl':
      return '96px'
    default:
      return '40px'
  }
})
</script>
