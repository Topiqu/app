<template>
  <div class="pt-4 min-h-screen max-w-screen flex-1 flex flex-col bg-gray-100/90 relative overflow-hidden">
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <Sidebar v-if="auth && isAdmin" v-model:isOpen="isSidebarOpen" />
    <slot />
    <ButtonBackToTop />
    <ClientVersion v-if="isAdmin" />
    <Footer />
  </div>
</template>

<script setup lang="ts">
const { data: auth } = useAuth()
const isSidebarOpen = shallowRef<boolean>(true)
const isAdmin = computed(() => ['admin', 'superadmin'].includes(auth?.value?.user.role || ''))
</script>
