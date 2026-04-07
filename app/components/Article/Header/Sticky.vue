<template>
  <div
    class="fixed top-0 left-0 right-0 w-full z-40 transform transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) border-b border-gray-200/50 dark:border-gray-800/50 bg-white/95 backdrop-blur-md dark:bg-neutral-900/95"
    :class="isSticky ? 'translate-y-0 opacity-100 shadow-sm' : '-translate-y-full opacity-0'"
  >
    <div class="max-w-[1000px] mx-auto h-16 px-4 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
      <div class="flex justify-start shrink-0">
        <NuxtLink
          to="/admin"
          class="group inline-flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-all"
          :aria-label="$t('common.actions.backToList')"
        >
          <Icon name="mdi:arrow-left" class="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span class="hidden sm:inline text-sm font-semibold">{{ $t('common.actions.backToList') }}</span>
        </NuxtLink>
      </div>

      <div class="flex items-center justify-center min-w-0 w-full gap-3">
        <div
          v-if="series"
          class="flex items-center shrink-0 max-w-[40%] sm:max-w-none gap-1.5 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50"
        >
          <span class="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300 truncate">
            {{ series.name }}
          </span>
          <span class="w-px h-2.5 bg-blue-200 dark:bg-blue-700 shrink-0"></span>
          <span class="text-[10px] font-bold text-blue-600 dark:text-blue-300 shrink-0">
            {{ series.current }}/{{ series.total }}
          </span>
        </div>

        <h1 class="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate leading-tight">
          {{ title }}
        </h1>
      </div>

      <div class="flex justify-end items-center shrink-0">
        <button
          class="group relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border transition-all duration-300 ease-out"
          :class="[
            likedByUser
              ? 'border-red-200 bg-red-50 text-red-500 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400'
              : 'border-gray-200 bg-transparent text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:border-gray-700 dark:text-gray-500 dark:hover:border-red-900/50 dark:hover:bg-red-900/10 dark:hover:text-red-400',
          ]"
          :title="$t('common.actions.like')"
          @click="$emit('like')"
        >
          <Icon
            :name="likedByUser ? 'mdi:heart' : 'mdi:heart-outline'"
            class="w-5 h-5 transition-transform duration-300 group-hover:scale-110 group-active:scale-90"
          />
        </button>
      </div>
    </div>

    <div class="absolute bottom-0 left-0 w-full h-[3px] bg-gray-100 dark:bg-gray-800 overflow-hidden">
      <div
        class="h-full bg-gradient-to-r transition-all duration-150 ease-linear shadow-sm"
        :class="progressBarColor"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { themes } from '~/composables/theme'

const props = defineProps<{
  isSticky: boolean
  progress: number
  title: string
  likedByUser: boolean
  series?: { name: string; current: number; total: number }
  clientTheme?: string
}>()

defineEmits<{
  (e: 'like'): void
}>()

const progressBarColor = computed(() => {
  if (props.clientTheme && Object.keys(themes).includes(props.clientTheme)) {
    return themes[props.clientTheme as keyof typeof themes]
  }
  return themes.blue
})
</script>
