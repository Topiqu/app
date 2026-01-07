<template>
  <NuxtLoadingIndicator
    class="z-[9999]"
    :color="
      clientSite?.theme && Object.keys(themeColors).includes(clientSite!.theme)
        ? themeColors[clientSite!.theme]
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
const reqUrl = useRequestURL()
const clientSite = await useClientSite()
const adChance = useAdChance()
// throw createError({ statusCode: 400, message: 'Service Unavailable', statusMessage: 'Service Unavailable' })
adChance?.assign(clientSite!.id, clientSite!.plan)
console.log(adChance?.adTargeting.value)

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
  title: () => clientSite?.name || $t('seo.default.title'),
  description: () => clientSite?.description || $t('seo.default.description'),
  keywords: () =>
    Array.isArray(clientSite?.keywords)
      ? clientSite.keywords.join(', ')
      : typeof clientSite?.keywords === 'string'
        ? clientSite.keywords
        : $t('seo.default.keywords'),
  author: () => clientSite?.name || $t('seo.default.author'),
  ogTitle: () => clientSite?.name || $t('seo.default.title'),
  ogDescription: () => clientSite?.description || $t('seo.default.description'),
  ogImage: () => clientSite?.logoUrl || '/default-og-image.webp',
  ogLocale: () => clientSite?.language || 'en',
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: clientSite?.name || $t('seo.default.title'),
          url: reqUrl.origin,
          description: clientSite?.description || $t('seo.default.description'),
          publisher: {
            '@type': 'Organization',
            name: clientSite?.name || $t('seo.default.author'),
            logo: {
              '@type': 'ImageObject',
              url: clientSite?.logoUrl || `${reqUrl.origin}/logo.png`,
            },
          },
          inLanguage: clientSite?.language || 'en',
        }),
      ),
    },
  ],
})
</script>
