<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator class="z-top" :color="computedThemeColor" />
    <NuxtRouteAnnouncer />
    <NetworkIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <DevOnly v-if="!isBrowserTest">
      <DevConsole />
    </DevOnly>

    <ClientOnly>
      <ClientVersion v-if="auth?.user?.role === 'admin'" />
    </ClientOnly>
  </UApp>
</template>

<script setup lang="ts">
import { cs, en } from '@nuxt/ui/locale'
import { toAbsoluteUrl } from '~~/shared/utils/seo'

import { resolveTenantTheme, themeColors } from '~/composables/theme'

const reqUrl = useRequestURL()
const route = useRoute()
const clientSite = await useClientSite()
const adChance = useAdChance()
const i18nHead = useLocaleHead()
const canonicalOrigin = useCanonicalOrigin()
const { locale } = useI18n()
const { data: auth } = useAuth()
const uiLocale = computed(() => (locale.value === 'cs' ? cs : en))
const isBrowserTest = Boolean(useRuntimeConfig().public.browserTest)

const isArticleRoute = computed(() => String(route.name ?? '').startsWith('clanky-slug'))
const i18nLinks = computed(() =>
  (i18nHead.value.link ?? [])
    .filter((link) => !(isArticleRoute.value && link.rel === 'alternate'))
    .map((link) =>
      typeof link.href === 'string' ? { ...link, href: toAbsoluteUrl(link.href, canonicalOrigin) } : link,
    ),
)

onMounted(() => {
  document.documentElement.dataset.topiquHydrated = 'true'
})

const localePath = useLocalePath()

const isAppHost = reqUrl.hostname.replace(/^www\./, '') === 'app.topiqu.com'

if (isAppHost && String(route.name || '').startsWith('index')) {
  await navigateTo(localePath({ name: 'autorizace' }))
}

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
    ...i18nLinks.value,
    {
      rel: 'icon',
      href: clientSite?.faviconUrl || clientSite?.logoUrl || '/favicon.ico',
    },
    ...(clientSite
      ? [
          {
            rel: 'alternate' as const,
            type: 'application/rss+xml',
            title: clientSite.name,
            href: `${canonicalOrigin}/rss.xml`,
          },
        ]
      : []),
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

// Only the identity. `nuxt-schema-org`'s i18n plugin already emits WebSite and WebPage with
// locale-aware `@id`s off the (per-tenant) site config — redefining them here detached
// `WebPage.isPartOf` from the WebSite node it pointed at. No explicit `url` either: passing one
// splits the identity into a second node.
if (clientSite) {
  useSchemaOrg([
    defineOrganization({
      name: clientSite.name,
      logo: targetLogoUrl,
      ...(clientSite.description ? { description: clientSite.description } : {}),
      // Ties the blog to accounts the engine already has an entity for.
      sameAs: clientSite.socials?.map((social) => social.url) ?? [],
    }),
  ])
}
</script>
