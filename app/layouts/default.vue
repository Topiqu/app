<template>
  <!-- `clip` not `hidden`: `hidden` makes this a scroll container, which scopes every
       descendant `position: sticky` to a box that never scrolls and silently kills it. -->
  <div
    class="min-h-screen max-w-screen flex-1 flex flex-col bg-[#f7f5ef] dark:bg-[#111712] relative overflow-x-clip"
    :style="{ '--client-accent': clientAccent }"
  >
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <Sidebar v-if="auth && isAdmin" v-model:isOpen="isSidebarOpen" />
    <slot />
    <ButtonBackToTop />
    <ClientVersion v-if="isAdmin" />
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { themeColors, type ThemeKey } from '~/composables/theme'

const { data: auth } = useAuth()
const clientSite = await useClientSite()
const isSidebarOpen = shallowRef<boolean>(true)
const isAdmin = computed(() => ['admin', 'superadmin'].includes(auth?.value?.user.role || ''))
const clientAccent = computed(() => themeColors[clientSite?.theme as ThemeKey] ?? themeColors.blue)
</script>
