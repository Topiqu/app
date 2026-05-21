<template>
  <Teleport to="body">
    <Transition
      enterActiveClass="motion-safe:transition motion-safe:duration-300 motion-safe:ease-out"
      leaveActiveClass="motion-safe:transition motion-safe:duration-200 motion-safe:ease-in"
      enterFromClass="opacity-0 motion-safe:translate-y-3 motion-safe:scale-90"
      leaveToClass="opacity-0 motion-safe:translate-y-3 motion-safe:scale-90"
    >
      <Button
        v-if="isVisible"
        :class="[
          'fixed bottom-8 right-6 sm:bottom-12 sm:right-8 z-30',
          'w-11 h-11 sm:w-12 sm:h-12 rounded-full',
          'bg-gradient-to-br shadow-lg shadow-black/10 dark:shadow-black/40',
          'ring-1 ring-white/10 backdrop-blur-sm',
          'motion-safe:transition-transform motion-safe:duration-200',
          'hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
          themeGradient,
          themeRing,
        ]"
        icon="i-lucide:arrow-up"
        size="lg"
        :aria="$t('common.actions.backToTop')"
        @click="scrollToTop"
      />
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { themes } from '~/composables/theme'

const clientSite = await useClientSite()
const { height } = useWindowSize()
const reduced = usePreferredReducedMotion()

const { y } = useWindowScroll({
  behavior: () => (reduced.value === 'reduce' ? 'auto' : 'smooth'),
})

const threshold = computed(() => Math.max(400, height.value * 0.6))
const isVisible = computed(() => y.value > threshold.value)

const themeKey = computed(() => {
  const t = clientSite?.theme as keyof typeof themes | undefined
  return t && t in themes ? t : 'blue'
})

const themeGradient = computed(() => themes[themeKey.value])

const ringByTheme: Record<keyof typeof themes, string> = {
  blue: 'focus-visible:ring-blue-500',
  green: 'focus-visible:ring-green-500',
  red: 'focus-visible:ring-red-500',
  purple: 'focus-visible:ring-purple-500',
  orange: 'focus-visible:ring-orange-500',
  teal: 'focus-visible:ring-teal-500',
  yellow: 'focus-visible:ring-yellow-500',
  pink: 'focus-visible:ring-pink-500',
  indigo: 'focus-visible:ring-indigo-500',
  gray: 'focus-visible:ring-gray-500',
  lime: 'focus-visible:ring-lime-500',
  sky: 'focus-visible:ring-sky-500',
  amber: 'focus-visible:ring-amber-500',
  cyan: 'focus-visible:ring-cyan-500',
  violet: 'focus-visible:ring-violet-500',
}
const themeRing = computed(() => ringByTheme[themeKey.value])

const scrollToTop = () => {
  y.value = 0
}
</script>
