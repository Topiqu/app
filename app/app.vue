<template>
  <NuxtLoadingIndicator class="z-[9999]" :color="computedThemeColor" />
  <StatusBar />

  <Landing v-if="!clientSite && !isOauthRoute" />

  <div v-else>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { Buffer } from 'node:buffer'

import type { themes } from '~/composables/theme'

const reqUrl = useRequestURL()
const route = useRoute()
const isOauthRoute = computed(() => route.path.includes('/oauth-start'))
const clientSite = await useClientSite()
const adChance = useAdChance()

if (clientSite) {
  adChance?.assign(clientSite.id, clientSite.plan)
}

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

const computedThemeColor = computed(() => {
  if (!clientSite) return themeColors.blue
  return clientSite.theme && Object.keys(themeColors).includes(clientSite.theme)
    ? themeColors[clientSite.theme as keyof typeof themes]
    : themeColors.blue
})

useSeoMeta({
  title: () => clientSite?.name || 'Topiqu',
  description: () => clientSite?.description || 'Moderní blogovací platforma',
  keywords: () =>
    Array.isArray(clientSite?.keywords)
      ? clientSite.keywords.join(', ')
      : typeof clientSite?.keywords === 'string'
        ? clientSite.keywords
        : 'blog, ai, platforma',
  author: () => clientSite?.name || 'Topiqu',
  ogTitle: () => clientSite?.name || 'Topiqu',
  ogDescription: () => clientSite?.description || 'Moderní blogovací platforma',
  ogLocale: () => clientSite?.language || 'cs',
  ogImageWidth: 1200,
  ogImageHeight: 600,
  twitterImageWidth: 1200,
  twitterImageHeight: 600,
  twitterCard: 'summary_large_image',
})

const targetLogoUrl = clientSite?.logoUrl || `${reqUrl.origin}/app-logo.png`

const { data: base64Logo } = await useAsyncData(
  'og-proxy-logo',
  async () => {
    if (!targetLogoUrl) return undefined
    try {
      const proxy = `/api/og-proxy?url=${encodeURIComponent(targetLogoUrl)}`
      const buf = await $fetch<ArrayBuffer>(proxy, { responseType: 'arrayBuffer' })
      return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    } catch {
      return undefined
    }
  },
  { server: true },
)

const ogImageOptions = computed(() => {
  if (clientSite) {
    return {
      component: 'ClientSite',
      title: clientSite.name,
      description: clientSite.description || '',
      siteName: clientSite.name,
      siteLogo: base64Logo.value || targetLogoUrl,
      themeColor: computedThemeColor.value,
      domain: reqUrl.host,
    }
  }
  return {
    component: 'AppDefault',
    title: 'Topiqu',
    description: 'Moderní blogovací platforma poháněná AI',
  }
})

defineOgImageComponent(ogImageOptions.value.component, ogImageOptions.value)

useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/x-icon',
      href: clientSite?.logoUrl || '/favicon.ico',
    },
  ],
})

if (clientSite) {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: computed(() =>
          JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: clientSite.name,
            url: reqUrl.origin,
            description: clientSite.description,
            publisher: {
              '@type': 'Organization',
              name: clientSite.name,
              logo: {
                '@type': 'ImageObject',
                url: clientSite.logoUrl || `${reqUrl.origin}/app-logo.png`,
              },
            },
            inLanguage: clientSite.language || 'en',
          }),
        ),
      },
    ],
  })
}
</script>
