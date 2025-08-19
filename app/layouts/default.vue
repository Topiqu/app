<template>
  <div class="min-h-screen max-w-screen flex-1 flex flex-col bg-gray-100 relative">
    <Sidebar v-if="auth && isAdmin" :isOpen="sidebarOpen" @update:isOpen="sidebarOpen = $event || false" />
    <div class="md:hidden p-4 bg-white shadow flex items-center justify-between">
      <button @click="sidebarOpen = !sidebarOpen">
        <Icon name="mdi:menu" class="w-6 h-6 text-black" />
      </button>
    </div>
    <div class="fixed right-28 z-100">
      <UserAccount />
    </div>
    <div class="fixed top-2 right-16 z-50">
      <ThemeToggle />
    </div>
    <div class="fixed top-2 right-2 z-100">
      <NotificationBar />
    </div>
    <slot />
    <ClientVersion v-if="isAdmin" :userId="auth?.user.id!" />
  </div>
</template>

<script setup lang="ts">
const { data: auth } = useAuth()

const sidebarOpen = shallowRef<boolean>(true)

const isAdmin = computed(() => ['admin', 'superadmin'].includes(auth?.value?.user.role || ''))
</script>
