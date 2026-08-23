<template>
  <div
    class="min-h-[100dvh] max-w-full pt-16"
    :class="[shell === 'dashboard' ? 'bg-muted' : 'bg-default', { 'publication-surface': isPublicationSurface }]"
    :style="publicationStyle"
  >
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <UDashboardGroup
      v-if="showDashboard"
      unit="px"
      storage="local"
      storageKey="topiqu-dashboard-sidebar"
      class="topiqu-dashboard-group fixed inset-x-0 bottom-0 top-16"
    >
      <Sidebar v-model:isOpen="isSidebarOpen" />
      <UDashboardPanel>
        <div class="topiqu-dashboard-scroll min-h-0 flex-1 overflow-y-auto">
          <UMain><slot /></UMain>
          <Footer />
        </div>
      </UDashboardPanel>
    </UDashboardGroup>
    <template v-else>
      <UMain><slot /></UMain>
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
</script>
