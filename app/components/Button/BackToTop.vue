<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <div v-if="isVisible" class="fixed bottom-12 right-8 z-50">
        <Button
          icon="i-lucide:arrow-up"
          size="lg"
          variant="primary"
          class="rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
          @click="scrollToTop"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
const isVisible = shallowRef(false)

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleScroll = () => {
  isVisible.value = window.scrollY > 300
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.3s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
