<template>
  <div
    :class="sizeClasses"
    class="flex items-center justify-center rounded-full overflow-hidden relative bg-gray-100 dark:bg-gray-800 isolate"
  >
    <Transition
      enterActiveClass="transition duration-200 ease-out"
      enterFromClass="opacity-0"
      enterToClass="opacity-100"
      leaveActiveClass="transition duration-500 ease-in"
      leaveFromClass="opacity-100"
      leaveToClass="opacity-0"
    >
      <div v-if="isRetrying" class="absolute inset-0 bg-gray-300 dark:bg-gray-600 animate-pulse z-20" />
    </Transition>

    <NuxtImg
      v-if="currentSrc"
      :src="currentSrc"
      :alt="(name || '') + ' ' + $t('common.avatar.alt.profile')"
      class="w-full h-full object-contain block transition-transform duration-300 hover:scale-105"
      width="160"
      height="160"
      @error="handleError"
      @load="handleLoad"
    />

    <div
      v-else
      :class="[
        'w-full h-full flex items-center justify-center font-medium uppercase transition-all duration-200',
        'bg-gray-200 !dark:bg-gray-700 text-gray-700 dark:text-gray-200',
      ]"
    >
      <span v-if="initial">{{ initial }}</span>
      <Icon v-else name="mdi:account-circle-outline" class="w-2/3 h-2/3 opacity-70" />
    </div>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  url?: string | null
  size?: 'mn' | 'sm' | 'md' | 'lg' | 'hg'
  name?: string | null
}>()

const { currentSrc, isRetrying, handleError, handleLoad } = useImageRetry(() => props.url)

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'mn':
      return 'w-6 h-6 text-[10px] sm:text-xs'
    case 'sm':
      return 'w-8 h-8 text-xs sm:text-sm'
    case 'lg':
      return 'w-12 h-12 sm:w-14 sm:h-14 text-lg sm:text-xl'
    case 'hg':
      return 'w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl'
    default:
      return 'w-10 h-10 text-sm sm:text-base'
  }
})

const initial = computed(() => props.name?.charAt(0).toUpperCase() ?? null)
</script>
