<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator class="z-top" :color="loadingColor" />
    <NuxtRouteAnnouncer />
    <NetworkIndicator v-if="!isWidgetPagePreview" />
    <AppOptimisticStatus v-if="!isWidgetPagePreview" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <ConsentManager v-if="!isWidgetPagePreview" :site="liveClientSite" :enabled="isPublicationSurface" />

    <DevOnly v-if="!isBrowserTest && !isWidgetPagePreview">
      <DevConsole />
    </DevOnly>

    <ClientOnly v-if="!isWidgetPagePreview">
      <LazyClientVersion v-if="consentLauncher === 'client-version'" />
      <ConsentSettingsButton v-else-if="consentLauncher === 'cookie-button'" />
    </ClientOnly>
  </UApp>
</template>

<script setup lang="ts">
import { cs, de, en, es, fr, it, nl, pl, pt, sk } from '@nuxt/ui/locale'
import manropeLatin from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url'

const reqUrl = useRequestURL()
const route = useRoute()
const { active: isWidgetPagePreview } = useWidgetPagePreview()
useWidgetPagePreviewBridge()
useHead(() => ({ meta: isWidgetPagePreview.value ? [{ name: 'robots', content: 'noindex, nofollow' }] : [] }))
const liveClientSite = await useLiveClientSite()
const i18nHead = useLocaleHead()
const canonicalOrigin = useCanonicalOrigin()
const { locale } = useI18n()
const { data: auth } = useAuth()
const uiLocales = { cs, de, en, fr, es, it, pl, sk, nl, pt }
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? en)
const isBrowserTest = Boolean(useRuntimeConfig().public.browserTest)

const isArticleRoute = computed(() => String(route.name ?? '').startsWith('clanky-slug'))
const isPublicationSurface = computed(() => resolvePageShell(route.meta.shell) === 'publication')
const consentLauncher = computed(() =>
  consentLauncherFor(
    auth.value?.user?.role,
    isPublicationSurface.value,
    isForeignHost(liveClientSite.value?.id, auth.value?.user?.clientSiteId),
  ),
)
// A blog only has real alternates in the languages it publishes; the rest would be translated chrome around
// the same articles.
const siteLanguages = computed(() =>
  liveClientSite.value
    ? new Set<string>([liveClientSite.value.language, ...(liveClientSite.value.translationLanguages ?? [])])
    : null,
)
const isForeignAlternate = (hreflang: unknown) =>
  typeof hreflang === 'string' && hreflang !== 'x-default' && !siteLanguages.value?.has(hreflang.split('-')[0]!)
const i18nLinks = computed(() =>
  publicationSeoLinks(
    liveClientSite.value,
    (i18nHead.value.link ?? [])
      .filter((link) => !(isArticleRoute.value && link.rel === 'alternate'))
      .filter((link) => !(siteLanguages.value && link.rel === 'alternate' && isForeignAlternate(link.hreflang)))
      .map((link) =>
        typeof link.href === 'string' ? { ...link, href: toAbsoluteUrl(link.href, canonicalOrigin) } : link,
      ),
  ),
)

onMounted(() => {
  document.documentElement.dataset.topiquHydrated = 'true'
})

const computedThemeColor = computed(() =>
  resolveBrandAccent(liveClientSite.value?.theme, liveClientSite.value?.accentColor),
)
const brandGradient = computed(() =>
  activeBrandGradient(liveClientSite.value?.brandGradient, liveClientSite.value?.plan),
)
const loadingColor = computed(() => (brandGradient.value ? gradientCss(brandGradient.value) : computedThemeColor.value))

useSeoMeta({
  title: () => liveClientSite.value?.name || 'Topiqu',
  description: () =>
    liveClientSite.value?.description || liveClientSite.value?.tagline || 'Moderní blogovací platforma',
  author: () => liveClientSite.value?.name || 'Topiqu',
  ogTitle: () => brandTitle(liveClientSite.value?.name, liveClientSite.value?.tagline) || 'Topiqu',
  ogDescription: () =>
    liveClientSite.value?.description || liveClientSite.value?.tagline || 'Moderní blogovací platforma',
  ogLocale: () => languageTag(liveClientSite.value?.language).replace('-', '_'),
  ogImageWidth: 1200,
  ogImageHeight: 600,
  twitterImageWidth: 1200,
  twitterImageHeight: 600,
  twitterCard: 'summary_large_image',
})

const targetLogoUrl = computed(() => liveClientSite.value?.logoUrl || `${reqUrl.origin}/app-logo.png`)

if (liveClientSite.value) {
  defineOgImage('ClientSite', {
    title: liveClientSite.value.name,
    description: liveClientSite.value.description || liveClientSite.value.tagline || '',
    siteName: liveClientSite.value.name,
    siteLogo: targetLogoUrl.value,
    themeColor: computedThemeColor.value,
    brandGradient: brandGradient.value ? gradientCss(brandGradient.value) : undefined,
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
    {
      key: 'topiqu-manrope-latin',
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: manropeLatin,
      crossorigin: 'anonymous',
    },
    ...i18nLinks.value,
    {
      rel: 'icon',
      href: liveClientSite.value?.faviconUrl || liveClientSite.value?.logoUrl || '/favicon.ico?v=20260908',
    },
    ...(liveClientSite.value ? [] : [{ rel: 'apple-touch-icon' as const, href: '/apple-touch-icon.png' }]),
    ...(liveClientSite.value && !hasExternalContentHome(liveClientSite.value)
      ? [
          {
            rel: 'alternate' as const,
            type: 'application/rss+xml',
            title: liveClientSite.value.name,
            href: `${canonicalOrigin}/rss.xml`,
          },
        ]
      : []),
  ],
  meta: [
    ...(i18nHead.value.meta || []),
    {
      name: 'keywords',
      content: Array.isArray(liveClientSite.value?.keywords)
        ? liveClientSite.value.keywords.join(', ')
        : typeof liveClientSite.value?.keywords === 'string'
          ? liveClientSite.value.keywords
          : 'blog, ai, platforma',
    },
    { name: 'theme-color', content: computedThemeColor.value },
  ],
}))

// Only the identity. `nuxt-schema-org`'s i18n plugin already emits WebSite and WebPage with
// locale-aware `@id`s off the (per-tenant) site config — redefining them here detached
// `WebPage.isPartOf` from the WebSite node it pointed at. No explicit `url` either: passing one
// splits the identity into a second node.
if (liveClientSite.value) {
  useSchemaOrg(
    computed(() => [
      defineOrganization({
        name: liveClientSite.value?.name,
        logo: targetLogoUrl.value,
        ...(liveClientSite.value?.description ? { description: liveClientSite.value.description } : {}),
        // Ties the blog to accounts the engine already has an entity for.
        sameAs: liveClientSite.value?.socials?.map((social) => social.url) ?? [],
      }),
    ]),
  )
}
</script>
