<template>
  <NuxtLoadingIndicator class="z-[9999]" />
  <StatusBar />
  <div>
    <NuxtLayout> <NuxtPage /> </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Topiqo AI blog',
  description: 'Vítejte v Topiqo blogu.',
  keywords: 'blog, Topiqo, insights, stories, journey',
  author: 'Big John',
})
</script>
