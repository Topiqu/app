<template>
  <NuxtLoadingIndicator class="z-[9999]" />
  <StatusBar />
  <div>
    <NuxtLayout> <NuxtPage /> </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Topiqu AI blog',
  description: 'Vítejte v Topiqu blogu.',
  keywords: 'blog, Topiqu, insights, stories, journey',
  author: 'Big John',
})
</script>
