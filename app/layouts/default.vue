<template>
  <div class="flex min-h-[100dvh] max-w-full flex-col pt-16" :class="shell === 'dashboard' ? 'bg-muted' : 'bg-default'">
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <UDashboardGroup
      v-if="showDashboard"
      unit="px"
      storage="cookie"
      storageKey="topiqu-dashboard-sidebar"
      class="topiqu-dashboard-group fixed inset-x-0 bottom-0 top-16"
    >
      <LazySidebar v-model:isOpen="isSidebarOpen" />
      <UDashboardPanel>
        <div class="topiqu-dashboard-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          <WidgetBar v-if="announcement" :announcement />
          <UMain class="flex min-h-0 grow shrink-0 flex-col"><slot /></UMain>
          <WidgetSlot
            v-if="isPublicationSurface && footerVisible"
            name="FOOTER"
            class="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"
          />
          <Footer v-if="shell !== 'dashboard'" />
        </div>
      </UDashboardPanel>
    </UDashboardGroup>
    <template v-else>
      <WidgetPagePreviewSlot
        v-if="preview.active.value"
        name="BAR"
        :hasContent="Boolean(previewAnnouncement || announcement)"
      >
        <FormClientWidgetPreview v-if="previewAnnouncement" :widget="previewAnnouncement" />
        <WidgetBar
          v-else-if="announcement && announcement.id !== preview.state.value.editingId"
          :announcement
          preview
        />
      </WidgetPagePreviewSlot>
      <WidgetBar v-else-if="announcement" :announcement />
      <UMain class="flex min-h-0 grow shrink-0 flex-col"><slot /></UMain>
      <WidgetSlot
        v-if="isPublicationSurface && footerVisible"
        name="FOOTER"
        class="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8"
      />
      <Footer />
    </template>
    <template v-if="showDashboard && auth?.user?.role === 'admin'">
      <LazyTagsCreate v-if="tagsMounted" v-model="tagsOpen" />
    </template>
    <LazyClientCreate v-if="auth?.user?.role === 'superadmin' && clientCreateMounted" v-model="clientCreateOpen" />
    <LazyUserList v-if="auth?.user?.role === 'superadmin' && userListMounted" v-model="userListOpen" />
    <ButtonBackToTop />
  </div>
</template>

<script setup lang="ts">
import { resolveFooterSettings } from '~~/shared/utils/publicationFooter'
const { data: auth } = useAuth()
const route = useRoute()
const preview = useWidgetPagePreview()
const clientSite = await useLiveClientSite()
const footerVisible = computed(
  () => resolveFooterSettings(clientSite.value?.footerSettings, clientSite.value?.plan).enabled,
)
const isSidebarOpen = shallowRef<boolean>(false)
const tagsOpen = useState('dashboard-tags-open', () => false)
const clientCreateOpen = useState('dashboard-client-create-open', () => false)
const userListOpen = useState('dashboard-user-list-open', () => false)
// Keep a previously opened dialog alive for its closing transition and focus restoration.
const tagsMounted = computed<boolean>((previous) => Boolean(previous || tagsOpen.value))
const clientCreateMounted = computed<boolean>((previous) => Boolean(previous || clientCreateOpen.value))
const userListMounted = computed<boolean>((previous) => Boolean(previous || userListOpen.value))
const shell = computed(() => resolvePageShell(route.meta.shell))
const showDashboard = useDashboardAccess(clientSite)
const isPublicationSurface = computed(() => {
  return Boolean(clientSite.value && shell.value === 'publication')
})
const { locale } = useI18n()
const announcement = computed(() =>
  isPublicationSurface.value ? activeAnnouncement(clientSite.value?.widgets ?? [], locale.value) : null,
)
const previewAnnouncement = computed(() =>
  preview.state.value.widget?.kind === 'ANNOUNCEMENT' ? preview.state.value.widget : null,
)
const publicationStyle = computed(() => {
  if (!isPublicationSurface.value) return undefined
  return tenantThemeStyle(clientSite.value?.theme, clientSite.value?.typographyPreset, {
    accentColor: clientSite.value?.accentColor,
    brandGradient: clientSite.value?.brandGradient,
    plan: clientSite.value?.plan,
    headingFontUrl: clientSite.value?.headingFontUrl,
    bodyFontUrl: clientSite.value?.bodyFontUrl,
  })
})

const cdnUrl = useRuntimeConfig().public.cdnUrl
useHead(() => {
  const site = clientSite.value
  const css = site
    ? tenantFontFaceCss(site.id, cdnUrl, site.typographyPreset, {
        plan: site.plan,
        headingFontUrl: site.headingFontUrl,
        bodyFontUrl: site.bodyFontUrl,
      })
    : ''
  return { style: css ? [{ key: 'publication-custom-fonts', innerHTML: css }] : [] }
})
// On <html>, not the layout root: teleported UI (modals, toasts, back-to-top) must inherit the brand too.
useHead(() => ({
  htmlAttrs: isPublicationSurface.value
    ? {
        class: 'publication-surface',
        style: Object.entries(publicationStyle.value ?? {})
          .map(([name, value]) => `${name}:${value}`)
          .join(';'),
      }
    : {},
}))

// The desktop collapsed state is persisted by UDashboardGroup. The drawer is transient
// and must never survive hydration as an overlay hiding the current page.
onMounted(() => {
  isSidebarOpen.value = false
})

watch(
  () => route.path,
  async () => {
    if (resolvePageShell(route.meta.shell) !== 'publication' || route.hash) return
    await nextTick()
    document.querySelector<HTMLElement>('.topiqu-dashboard-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
)
</script>
