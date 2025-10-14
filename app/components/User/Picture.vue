<template>
  <div :class="sizeClasses" class="flex items-center justify-center rounded-full overflow-hidden">
    <NuxtImg
      v-if="url"
      :src="url"
      :alt="(name || '') + ' ' + $t('common.avatar.alt.profile')"
      class="w-full h-full object-contain block transition-all duration-200 hover:ring-gray-400 dark:hover:ring-gray-500"
      width="160"
      height="160"
    />
    <div
      v-else
      :class="[
        sizeClasses,
        'flex items-center justify-center rounded-full font-medium uppercase transition-all duration-200',
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
