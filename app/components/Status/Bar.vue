<template>
  <transition name="slide">
    <div
      v-if="showBar"
      :class="[
        isOnline ? 'bg-green-500' : 'bg-red-500',
        'fixed bottom-0 left-0 right-0 text-white p-2 text-center z-1000',
      ]"
    >
      {{ isOnline ? $t('common.connection.online') : $t('common.connection.offline') }}
    </div>
  </transition>
</template>

<script setup lang="ts">
const isOnline = useOnline()
const showBar = shallowRef<boolean>(false)

const showTemporaryBar = () => {
  showBar.value = true
  setTimeout(() => (showBar.value = false), 3000)
}

watch(isOnline, (online, prev) => {
  if (online && prev === false) showTemporaryBar()
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
