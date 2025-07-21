<template>
  <div class="min-h-screen max-w-screen bg-gray-100 flex">
    <Sidebar
      v-if="data?.user && isAdmin"
      :isOpen="sidebarOpen"
      @update:isOpen="sidebarOpen = $event"
    />
    <div class="flex-1 flex flex-col">
      <div
        class="md:hidden p-4 bg-white shadow flex items-center justify-between"
      >
        <button @click="sidebarOpen = !sidebarOpen">
          <Icon name="mdi:menu" class="w-6 h-6 text-black" />
        </button>
      </div>
      <slot />
      <ClientVersion v-if="isAdmin" />
    </div>
  </div>
</template>

<script setup lang="ts">
const { data } = useAuth()
const sidebarOpen = ref(true)

const isAdmin = computed(() => {
  return ['admin', 'superadmin'].includes(data?.value?.user.role ?? '')
})
</script>
