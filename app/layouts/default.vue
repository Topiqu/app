<template>
  <div class="pt-4 min-h-screen max-w-screen flex-1 flex flex-col bg-gray-100/90 relative overflow-hidden">
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <Sidebar v-if="auth && isAdmin" v-model:isOpen="isSidebarOpen" />
    <slot />
    <ButtonBackToTop />
    <ClientVersion v-if="isAdmin" :userId="auth?.user.id!" />
    <template v-if="!theme.isDark">
      <div
        v-for="(obj, index) in floatingObjects"
        :key="index"
        class="absolute pointer-events-none -z-10"
        :style="{
          left: `${obj.x}%`,
          top: `${obj.y}%`,
          width: `${obj.size}px`,
          height: `${obj.size}px`,
          '--start-rotation': `${obj.rotation}deg`,
          '--end-rotation': `${obj.rotation + 5}deg`,
          transition: 'background 0.5s ease',
        }"
      >
        <svg
          :class="currentTheme"
          :style="{
            width: '100%',
            height: '100%',
            filter: 'blur(6px) opacity(0.85)',
            mixBlendMode: 'overlay',
          }"
          viewBox="0 0 100 100"
        >
          <path :d="obj.path" fill="url(#gradient)" />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" :style="{ stopColor: getGradientColors(currentTheme)[0] }" />
              <stop offset="100%" :style="{ stopColor: getGradientColors(currentTheme)[1] }" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { themes } from '~/composables/theme'
const theme = useThemeStore()
const { data: auth } = useAuth()
const isSidebarOpen = shallowRef<boolean>(true)
const isAdmin = computed(() => ['admin', 'superadmin'].includes(auth?.value?.user.role || ''))

const floatingObjects = ref<
  Array<{
    x: number
    y: number
    size: number
    rotation: number
    duration: number
    delay: number
    path: string
  }>
>([
  { x: 10, y: 20, size: 140, rotation: 45, duration: 8, delay: Math.random() * 5, path: 'M50 10 L90 90 H10 Z' },
  { x: 80, y: 30, size: 120, rotation: 90, duration: 12, delay: Math.random() * 5, path: 'M20 20 L80 20 L50 80 Z' },
  { x: 30, y: 70, size: 170, rotation: 0, duration: 10, delay: Math.random() * 5, path: 'M30 20 L80 40 L50 90 Z' },
  { x: 60, y: 50, size: 130, rotation: 135, duration: 9, delay: Math.random() * 5, path: 'M10 50 L50 10 L90 50 Z' },
  { x: 20, y: 40, size: 150, rotation: 60, duration: 11, delay: Math.random() * 5, path: 'M50 10 L90 90 H10 Z' },
  { x: 50, y: 10, size: 130, rotation: 30, duration: 10, delay: Math.random() * 5, path: 'M50 20 L80 80 H20 Z' },
  { x: 70, y: 80, size: 160, rotation: 120, duration: 9, delay: Math.random() * 5, path: 'M30 30 L70 30 L50 70 Z' },
])

const currentTheme = ref<keyof typeof themes>('blue')
const themeKeys = Object.keys(themes) as (keyof typeof themes)[]

function getGradientColors(theme: keyof typeof themes): [string, string] {
  const [lightFrom, lightTo] = themes[theme]
    .split(' ')
    .filter((c) => c.startsWith('from-') || c.startsWith('to-'))
    .map((c) => c.replace('from-', '').replace('to-', ''))
  return [`var(--color-${lightFrom})`, `var(--color-${lightTo})`]
}

onMounted(() => {
  const interval = setInterval(() => {
    currentTheme.value = themeKeys[Math.floor(Math.random() * themeKeys.length)]!
  }, 10000)
  onUnmounted(() => clearInterval(interval))
})
</script>
