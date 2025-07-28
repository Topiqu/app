<template>
  <transition name="slide">
    <div
      v-if="showBar"
      :class="[isOnline ? 'bg-green-500' : 'bg-red-500', 'fixed bottom-0 left-0 right-0 text-white p-2 text-center']"
    >
      {{ isOnline ? 'Jste zpět online' : 'Jste offline' }}
    </div>
  </transition>
</template>

<script setup lang="ts">
const isOnline = useOnline()
const showBar = ref(false)

const verifyConnection = async () => {
  await $fetch('/api/ping', { method: 'HEAD', timeout: 5000 })
  showTemporaryBar()
}

const showTemporaryBar = () => {
  showBar.value = true
  setTimeout(() => (showBar.value = false), 3000)
}

watch(isOnline, (online, prev) => {
  if (online && prev === false) verifyConnection()
  if (!online) showTemporaryBar()
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateY(100%);
}
</style>
