<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <div v-if="isVisible" class="fixed bottom-12 right-8 z-50">
        <Button
          :class="[
            'w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer',
            clientThemeGradient,
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
          ]"
          icon="i-lucide:arrow-up"
          size="lg"
          aria="Back to Top"
          @click="scrollToTop"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { themes } from '~/composables/theme'

const isVisible = computed(() => y.value > 300)
const { y } = useScroll(window)

const clientSite = await useClientSite()

const clientThemeGradient = computed(
  () =>
    `bg-gradient-to-r ${themes[clientSite?.theme as keyof typeof themes] ?? 'from-blue-600 to-indigo-900 dark:from-blue-800 dark:to-indigo-950'}`,
)

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
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
