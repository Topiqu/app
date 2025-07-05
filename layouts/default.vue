<template>
  <div class="min-h-screen max-w-screen bg-gray-100 flex">
    <div class="hidden md:flex flex-shrink-0 items-center min-h-screen">
      <Sidebar v-if="data?.user" is-open />
    </div>
    <div class="flex-1 flex flex-col">
      <div
        class="md:hidden p-4 bg-white shadow flex items-center justify-between"
      >
        <button @click="sidebarOpen = !sidebarOpen">
          <Icon name="mdi:menu" class="w-6 h-6 text-black" />
        </button>
      </div>

      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const { data } = useAuth()
const sidebarOpen = ref(false)
</script>
