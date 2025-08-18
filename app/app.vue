<template>
  <NuxtLoadingIndicator class="z-[9999]" />
  <StatusBar />
  <div>
    <NuxtLayout> <NuxtPage /> </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({
  title: 'Topqio AI blog',
  description: 'Vítejte v Topqio blogu.',
  keywords: 'blog, Topqio, insights, stories, journey',
  author: 'Big John',
})
</script>
