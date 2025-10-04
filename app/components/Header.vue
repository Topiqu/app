<template>
  <div
    class="fixed top-0 left-0 p-2 h-16 w-full flex items-center justify-between max-md:bg-gray-100/60 max-md:backdrop-blur-sm !dark:bg-transparent pointer-events-none [&>*]:pointer-events-auto z-[999]"
  >
    <Button
      v-if="auth && isAdmin"
      variant="neutral"
      icon="mdi:menu"
      class="md:hidden"
      @click="isSidebarOpen = !isSidebarOpen"
    />
    <NuxtLink to="/" class="flex items-center justify-center gap-2">
      <NuxtImg :src="clientSite?.logoUrl || '/app-logo.png'" alt="Logo" class="w-14 object-conatin" />
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

// const slug = 'GameDev'

const clientSite = await useClientsite()

const { data: auth } = useAuth()

const isAdmin = computed(() => ['admin', 'superadmin'].includes(auth?.value?.user.role || ''))
</script>
