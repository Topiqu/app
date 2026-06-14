<template>
  <Teleport to="body">
    <Transition
      enterActiveClass="motion-safe:transition motion-safe:duration-300 motion-safe:ease-out"
      leaveActiveClass="motion-safe:transition motion-safe:duration-200 motion-safe:ease-in"
      enterFromClass="opacity-0 motion-safe:translate-y-3 motion-safe:scale-90"
      leaveToClass="opacity-0 motion-safe:translate-y-3 motion-safe:scale-90"
    >
      <div
        v-if="isVisible"
        class="fixed bottom-8 right-6 sm:bottom-12 sm:right-8 z-30 w-11 h-11 sm:w-12 sm:h-12 motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 active:scale-95"
      >
        <Button
          :class="[
            'w-full h-full rounded-full',
            'bg-gradient-to-br shadow-lg shadow-black/10 dark:shadow-black/40',
            'ring-1 ring-white/10 backdrop-blur-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
            themeGradient,
            themeRing,
          ]"
          icon="i-lucide:arrow-up"
          size="lg"
          :aria="$t('common.actions.backToTop')"
          @click="scrollToTop"
        />
        <svg
          class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            :r="RING_RADIUS"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            class="text-white/15"
          />
          <circle
            cx="24"
            cy="24"
            :r="RING_RADIUS"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            class="text-white/85 motion-safe:transition-[stroke-dashoffset] motion-safe:duration-150"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { themes, themeRings, type ThemeKey } from '~/composables/theme'

const clientSite = await useClientSite()
const { height } = useWindowSize()
const reduced = usePreferredReducedMotion()

const { y } = useWindowScroll({
  behavior: () => (reduced.value === 'reduce' ? 'auto' : 'smooth'),
})

const threshold = computed(() => Math.max(400, height.value * 0.6))
const isVisible = computed(() => y.value > threshold.value)

const RING_RADIUS = 22
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const progress = computed(() => {
  if (!import.meta.client) return 0
  const max = document.documentElement.scrollHeight - height.value
  return max > 0 ? Math.min(1, Math.max(0, y.value / max)) : 0
})
const dashOffset = computed(() => RING_CIRCUMFERENCE * (1 - progress.value))

const theme = clientSite?.theme as ThemeKey | undefined
const themeKey: ThemeKey = theme && theme in themes ? theme : 'blue'
const themeGradient = themes[themeKey]
const themeRing = themeRings[themeKey]

const scrollToTop = () => {
  y.value = 0
}
</script>
