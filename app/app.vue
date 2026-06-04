<template>
  <NuxtLoadingIndicator class="z-top" :color="computedThemeColor" />
  <NuxtRouteAnnouncer />
  <StatusBar />

  <Landing v-if="isMainLanding" />

  <template v-else>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </template>

  <DevOnly>
    <DevConsole />
  </DevOnly>
</template>

<script setup lang="ts">
import { themeColors, type ThemeKey } from '~/composables/theme'

const reqUrl = useRequestURL()
const route = useRoute()
const clientSite = await useClientSite()
const adChance = useAdChance()
const i18nHead = useLocaleHead()

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

const computedThemeColor = computed(
  () => themeColors[clientSite?.theme as ThemeKey] ?? themeColors.blue,
)

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

if (clientSite) {
  defineOgImage('ClientSite', {
    title: clientSite.name,
    description: clientSite.description || '',
    siteName: clientSite.name,
    siteLogo: targetLogoUrl,
    themeColor: computedThemeColor.value,
    domain: reqUrl.host,
  })
} else {
  defineOgImage('AppDefault', {
    title: 'Topiqu',
    description: 'Moderní blogovací platforma poháněná AI',
  })
}

useHead(() => ({
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs?.lang,
    dir: i18nHead.value.htmlAttrs?.dir as 'ltr' | 'rtl' | 'auto' | undefined,
  },
  link: [
    ...(i18nHead.value.link || []),
    {
      rel: 'icon',
      type: 'image/x-icon',
      href: clientSite?.logoUrl || '/favicon.ico',
    },
  ],
  meta: [
    ...(i18nHead.value.meta || []),
    { name: 'theme-color', content: computedThemeColor.value },
  ],
}))

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
