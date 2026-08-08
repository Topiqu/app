<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator class="z-top" :color="computedThemeColor" />
    <NuxtRouteAnnouncer />
    <StatusBar />

    <Landing v-if="isMainLanding" />

    <template v-else>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </template>

    <DevOnly v-if="!isBrowserTest">
      <DevConsole />
    </DevOnly>
  </UApp>
</template>

<script setup lang="ts">
import { cs, en } from '@nuxt/ui/locale'

import { resolveTenantTheme, themeColors } from '~/composables/theme'

const reqUrl = useRequestURL()
const router = useRouter()
const clientSite = await useClientSite()
const adChance = useAdChance()
const i18nHead = useLocaleHead()
const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'cs' ? cs : en))
const isBrowserTest = Boolean(useRuntimeConfig().public.browserTest)

onMounted(() => {
  document.documentElement.dataset.topiquHydrated = 'true'
})

const devView = import.meta.dev ? useDevView() : undefined
const localePath = useLocalePath()

const isAppHost = reqUrl.hostname.replace(/^www\./, '') === 'app.topiqu.com'

if (isAppHost && String(router.currentRoute.value.name || '').startsWith('index')) {
  await navigateTo(localePath({ name: 'autorizace' }))
}

const isMainLanding = computed(() => {
  if (import.meta.dev && devView && devView.value !== 'auto') {
    return devView.value === 'landing'
  }

  if (isAppHost) return false

  if (clientSite) return false

  const route = router.currentRoute.value
  const name = String(route.name || '')
  if (!name.startsWith('index')) return false
  if (name.includes('autorizace') || name.includes('admin')) return false

  if (route.path.includes('/oauth-start')) return false

  return true
})

if (clientSite) {
  adChance.assign(clientSite.id, clientSite.plan)
}

const computedThemeColor = computed(() => themeColors[resolveTenantTheme(clientSite?.theme)])

useSeoMeta({
  title: () => clientSite?.name || 'Topiqu',
  description: () => clientSite?.description || 'Moderní blogovací platforma',
  author: () => clientSite?.name || 'Topiqu',
  ogTitle: () => clientSite?.name || 'Topiqu',
  ogDescription: () => clientSite?.description || 'Moderní blogovací platforma',
  ogLocale: () => (clientSite?.language === 'cs' ? 'cs_CZ' : 'en_US'),
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
      href: clientSite?.faviconUrl || clientSite?.logoUrl || '/favicon.ico',
    },
  ],
  meta: [
    ...(i18nHead.value.meta || []),
    {
      name: 'keywords',
      content: Array.isArray(clientSite?.keywords)
        ? clientSite.keywords.join(', ')
        : typeof clientSite?.keywords === 'string'
          ? clientSite.keywords
          : 'blog, ai, platforma',
    },
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
