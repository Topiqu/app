<template>
  <NuxtLoadingIndicator class="z-[9999]" :color="computedThemeColor" />
  <StatusBar />

  <Landing v-if="isMainLanding" />

  <div v-else>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>

  <DevOnly>
    <DevConsole />
  </DevOnly>
</template>

<script setup lang="ts">
import type { themes } from '~/composables/theme'

const reqUrl = useRequestURL()
const route = useRoute()
const clientSite = await useClientSite()
const adChance = useAdChance()

const devView = import.meta.dev ? useDevView() : undefined

const isMainLanding = computed(() => {
  if (import.meta.dev && devView && devView.value !== 'auto') {
    return devView.value === 'landing'
  }

  if (clientSite) return false

  const name = String(route.name || '')
  if (name.includes('autorizace') || name.includes('admin')) return false

  if (route.path.includes('/oauth-start')) return false

  return true
})

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

const ogImageOptions = computed(() => {
  if (clientSite) {
    return {
      title: clientSite.name,
      description: clientSite.description || '',
      siteName: clientSite.name,
      siteLogo: targetLogoUrl,
      themeColor: computedThemeColor.value,
      domain: reqUrl.host,
    }
  }
  return {
    title: 'Topiqu',
    description: 'Moderní blogovací platforma poháněná AI',
  }
})

if (clientSite) {
  defineOgImage('ClientSite', ogImageOptions.value)
} else {
  defineOgImage('AppDefault', ogImageOptions.value)
}

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
