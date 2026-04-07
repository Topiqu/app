<template>
  <VueEasyLightbox :visible="visible" :imgs="images" :index="index" @hide="$emit('hide')" />
</template>

<script setup lang="ts">
import VueEasyLightbox from 'vue-easy-lightbox'

defineProps<{
  visible: boolean
  images: { src: string; alt?: string }[]
  index: number
}>()

defineEmits<{
  (e: 'hide'): void
}>()
</script>
