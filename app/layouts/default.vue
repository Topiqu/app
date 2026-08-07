<template>
  <!-- `clip` not `hidden`: `hidden` makes this a scroll container, which scopes every
       descendant `position: sticky` to a box that never scrolls and silently kills it. -->
  <div class="pt-4 min-h-screen max-w-screen flex-1 flex flex-col bg-gray-100/90 relative overflow-x-clip">
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
