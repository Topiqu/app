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
const clientSite = await useClientSite()
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
  title: () => clientSite?.name || 'Topiqu AI blog',
  description: () => clientSite?.description || 'Vítejte v Topiqu blogu.',
  keywords: () =>
    Array.isArray(clientSite?.keywords)
      ? clientSite.keywords.join(', ')
      : typeof clientSite?.keywords === 'string'
        ? clientSite.keywords
        : 'blog, AI, Topiqu',
  author: () => clientSite?.name || 'Topiqu',
  ogTitle: () => clientSite?.name || 'Topiqu AI blog',
  ogDescription: () => clientSite?.description || 'Vítejte v Topiqu blogu.',
  ogImage: () => clientSite?.logoUrl || '/default-og-image.webp',
  ogLocale: () => clientSite?.language || 'en',
})
</script>
