<template>
  <div
    class="flex min-h-[100dvh] max-w-full flex-col pt-16"
    :class="[shell === 'dashboard' ? 'bg-muted' : 'bg-default', { 'publication-surface': isPublicationSurface }]"
    :style="publicationStyle"
  >
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <UDashboardGroup
      v-if="showDashboard"
      unit="px"
      storage="cookie"
      storageKey="topiqu-dashboard-sidebar"
      class="topiqu-dashboard-group fixed inset-x-0 bottom-0 top-16"
    >
      <Sidebar v-model:isOpen="isSidebarOpen" />
      <UDashboardPanel>
        <div class="topiqu-dashboard-scroll min-h-0 flex-1 overflow-y-auto">
          <UMain :class="shell === 'dashboard' ? 'h-full min-h-full' : ''"><slot /></UMain>
          <Footer v-if="shell !== 'dashboard'" />
        </div>
      </UDashboardPanel>
    </UDashboardGroup>
    <template v-else>
      <UMain class="flex min-h-0 flex-1 flex-col"><slot /></UMain>
      <Footer />
    </template>
    <template v-if="auth?.user?.role === 'admin'">
      <TagsCreate v-model="tagsOpen" />
      <StatsDialog v-model="statsOpen" />
    </template>
    <ClientCreate v-if="auth?.user?.role === 'superadmin'" v-model="clientCreateOpen" />
    <UserList v-if="auth?.user?.role === 'superadmin'" v-model="userListOpen" />
    <ButtonBackToTop />
  </div>
</template>

<script setup lang="ts">
const { data: auth } = useAuth()
const route = useRoute()
const clientSite = await useClientSite()
const isSidebarOpen = shallowRef<boolean>(false)
const tagsOpen = useState('dashboard-tags-open', () => false)
const statsOpen = useState('dashboard-stats-open', () => false)
const clientCreateOpen = useState('dashboard-client-create-open', () => false)
const userListOpen = useState('dashboard-user-list-open', () => false)
const shell = computed(() => resolvePageShell(route.meta.shell))
const showDashboard = computed(() =>
  canRenderDashboardShell(shell.value, auth.value?.user.role, route.meta.dashboardSidebar),
)
const isPublicationSurface = computed(() => {
  return Boolean(clientSite && shell.value === 'publication')
})
const publicationStyle = computed(() => {
  if (!isPublicationSurface.value) return undefined
  return tenantThemeStyle(clientSite?.theme, clientSite?.typographyPreset)
})

// The desktop collapsed state is persisted by UDashboardGroup. The drawer is transient
// and must never survive hydration as an overlay hiding the current page.
onMounted(() => {
  isSidebarOpen.value = false
})

watch(
  () => route.path,
  async () => {
    if (resolvePageShell(route.meta.shell) !== 'publication') return
    await nextTick()
    document.querySelector<HTMLElement>('.topiqu-dashboard-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
)
</script>
