<template>
  <div class="pt-4 min-h-screen max-w-screen flex-1 flex flex-col bg-gray-100 relative overflow-hidden">
    <Header v-model:isSidebarOpen="isSidebarOpen" />
    <Sidebar v-if="auth && isAdmin" v-model:isOpen="isSidebarOpen" />
    <slot />
    <ButtonBackToTop />
    <ClientVersion v-if="isAdmin" :userId="auth?.user.id!" />
    <div
      v-for="(obj, index) in floatingObjects"
      :key="index"
      class="absolute pointer-events-none"
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
        :style="{ width: '100%', height: '100%', filter: 'blur(8px)', mixBlendMode: 'overlay' }"
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
  </div>
</template>

<script setup lang="ts">
import { themes } from '~/composables/theme'

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
  { x: 10, y: 20, size: 120, rotation: 45, duration: 8, delay: Math.random() * 5, path: 'M50 10 L90 90 H10 Z' },
  { x: 80, y: 30, size: 100, rotation: 90, duration: 12, delay: Math.random() * 5, path: 'M20 20 L80 20 L50 80 Z' },
  { x: 30, y: 70, size: 150, rotation: 0, duration: 10, delay: Math.random() * 5, path: 'M30 20 L80 40 L50 90 Z' },
  { x: 60, y: 50, size: 110, rotation: 135, duration: 9, delay: Math.random() * 5, path: 'M10 50 L50 10 L90 50 Z' },
  { x: 20, y: 40, size: 130, rotation: 60, duration: 11, delay: Math.random() * 5, path: 'M50 10 L90 90 H10 Z' },
])

const currentTheme = ref<keyof typeof themes>('blue')
const themeKeys = Object.keys(themes) as (keyof typeof themes)[]

function getGradientColors(theme: keyof typeof themes): [string, string] {
  const [lightFrom, lightTo] = themes[theme]
    .split(' ')
    .slice(0, 2)
    .map((c) => c.replace('from-', '').replace('to-', ''))
  return [`var(--color-${lightFrom})`, `var(--color-${lightTo})`]
}

onMounted(() => {
  const interval = setInterval(() => {
    currentTheme.value = themeKeys[Math.floor(Math.random() * themeKeys.length)]
  }, 10000)
  onUnmounted(() => clearInterval(interval))
})
</script>
