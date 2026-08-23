<template>
  <Teleport to="body">
    <UButton
      v-if="isVisible"
      color="primary"
      variant="solid"
      square
      class="back-to-top fixed right-6 z-30 sm:right-8"
      icon="i-mdi-arrow-up"
      size="lg"
      :aria-label="$t('common.actions.backToTop')"
      @click="scrollToTop"
    />
  </Teleport>
</template>

<script setup lang="ts">
const { height } = useWindowSize()
const reduced = usePreferredReducedMotion()
const mounted = useMounted()

const { y } = useWindowScroll({
  behavior: () => (reduced.value === 'reduce' ? 'auto' : 'smooth'),
})

const threshold = computed(() => Math.max(400, height.value * 0.6))
const isVisible = computed(() => mounted.value && y.value > threshold.value)

const scrollToTop = () => {
  y.value = 0
}
</script>
