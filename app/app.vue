<template>
  <NuxtLoadingIndicator
    class="z-[9999]"
    :color="
      clientSite?.theme && Object.keys(themeColors).includes(clientSite.theme)
        ? themeColors[clientSite.theme]
        : themeColors.blue
    "
  />
  <StatusBar />
  <div>
    <NuxtLayout> <NuxtPage /> </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import type { themes } from '~/composables/theme'
const slug = 'GameDev'

const { data: clientSite } = await useFetch(`/api/clients/slug/${slug}`, { server: false })
// throw createError({ statusCode: 400, message: 'Service Unavailable', statusMessage: 'Service Unavailable' })

const themeColors: Record<keyof typeof themes, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  purple: '#7c3aed',
  orange: '#f97316',
  teal: '#0d9488',
  yellow: '#eab308',
  pink: '#ec4899',
  indigo: '#4f46e5',
  gray: '#6b7280',
  lime: '#65a30d',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  violet: '#8b5cf6',
}

useSeoMeta({
  title: 'Topiqu AI blog',
  description: 'Vítejte v Topiqu blogu.',
  keywords: 'blog, Topiqu, insights, stories, journey',
  author: 'Big John',
})
</script>
