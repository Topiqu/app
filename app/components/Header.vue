<template>
  <div
    class="fixed top-0 left-0 px-3 sm:px-5 h-18 w-full flex items-center justify-between bg-white/72 dark:bg-gray-950/72 backdrop-blur-xl border-b border-gray-900/7 dark:border-white/10 pointer-events-none [&>*]:pointer-events-auto z-header"
  >
    <Button
      v-if="auth && isAdmin"
      variant="neutral"
      icon="mdi:menu"
      class="md:hidden"
      @click="isSidebarOpen = !isSidebarOpen"
    />
    <NuxtLink
      to="/"
      class="flex h-14 max-w-48 items-center justify-start rounded-xl px-2 py-1 transition hover:bg-gray-900/5 dark:hover:bg-white/8"
      :aria-label="$t('common.actions.home')"
    >
      <NuxtImg
        v-if="clientSite"
        :src="logoSrc"
        :alt="$t('common.avatar.alt.company')"
        width="176"
        height="48"
        fit="inside"
        class="block max-h-12 max-w-44 h-auto w-auto"
      />
      <div v-else class="h-11 w-28 animate-pulse rounded-lg bg-gray-200 dark:bg-neutral-700" />
    </NuxtLink>
    <div class="flex items-center justify-between gap-2">
      <UserAccount />
      <ThemeToggle />
      <NotificationBar />
    </div>
  </div>
</template>

<script lang="ts" setup>
const isSidebarOpen = defineModel<boolean>('isSidebarOpen')

const clientSite = await useClientSite()
const { data: auth } = useAuth()

const isAdmin = computed(() => ['admin', 'superadmin'].includes(auth?.value?.user.role || ''))
const logoSrc = computed(() => {
  return clientSite?.logoUrl || 'https://cdn.topiqu.com/app-logo.png'
})
</script>
