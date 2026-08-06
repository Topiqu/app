<template>
  <!--
    `overflow-x-clip`, not `overflow-hidden`: `hidden` makes this box a scroll container,
    which scopes every descendant `position: sticky` to a box that never scrolls — i.e. it
    silently kills the editor's sticky header, the Tiptap toolbar, the homepage filter bar
    and the footer. `clip` still contains horizontal bleed (its job, next to `max-w-screen`)
    without establishing a scrollport, and `overflow-y` stays `visible` beside it.
  -->
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
