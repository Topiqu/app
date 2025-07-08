<template>
  <NuxtLoadingIndicator class="z-[9999]" />
  <StatusBar />
  <div>
    <NuxtLayout> <NuxtPage /> </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'RASG blog',
  description: 'Vítejte v RASG blogu.',
  keywords: 'blog, RASG, insights, stories, journey',
  author: 'Big John',
})
</script>
