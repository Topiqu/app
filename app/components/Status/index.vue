<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div
      class="p-8 md:p-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-md w-full transition-all duration-300 ease-in-out transform"
      :class="{ 'scale-95 opacity-0': !isMounted, 'scale-100 opacity-100': isMounted }"
    >
      <slot name="icon">
        <div class="flex justify-center">
          <NuxtImg
            v-if="props.type === 'error' && props.message?.includes('404')"
            src="/topik_404_rm.png"
            alt="404 Stránka nenalezena"
            class="w-32 h-32 mx-auto mb-4 object-contain"
            loading="lazy"
            placeholder
          />
          <Icon v-else :name="iconName" class="w-12 h-12 mx-auto mb-4" :class="iconClass" aria-hidden="true" />
        </div>
      </slot>
      <slot name="title">
        <h2 class="text-2xl font-semibold text-center" :class="titleClass">
          {{ computedTitle }}
        </h2>
      </slot>
      <slot name="message">
        <p v-if="message" class="text-center text-base mt-2" :class="messageClass">
          {{ message }}
        </p>
      </slot>
      <slot v-if="type !== 'pending'" name="action">
        <div v-if="actionText" class="mt-6 flex justify-center">
          <NuxtLink
            :to="actionTo"
            class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
            :class="actionClass"
            :aria-label="actionText"
          >
            {{ actionText }}
          </NuxtLink>
        </div>
      </slot>
      <slot v-if="type === 'pending'" name="skeleton">
        <div class="mt-6 space-y-3">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto animate-pulse"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto animate-pulse"></div>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  type: 'error' | 'pending' | 'success'
  message?: string
  title?: string
  actionText?: string
  actionTo?: string
}>()
const isMounted = shallowRef<boolean>(false)
onMounted(() => {
  isMounted.value = true
})
const titles = { error: 'Chyba', pending: 'Načítám', success: 'Úspěch' } as const
const icons = { error: 'mdi:alert-circle', pending: 'mdi:loading', success: 'mdi:check-circle' } as const
const iconClasses = {
  error: 'text-red-500 animate-pulse',
  pending: 'text-blue-600 animate-spin',
  success: 'text-green-500',
} as const
const titleClasses = {
  error: 'text-red-600 dark:text-red-400',
  pending: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
} as const
const messageClasses = {
  error: 'text-gray-600 dark:text-gray-300',
  pending: 'text-gray-600 dark:text-gray-300',
  success: 'text-gray-600 dark:text-gray-300',
} as const
const actionClasses = {
  error: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800',
  pending: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
  success:
    'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800',
} as const
const computedTitle = computed(() => props.title || titles[props.type])
const iconName = computed(() => icons[props.type])
const iconClass = computed(() => iconClasses[props.type])
const titleClass = computed(() => titleClasses[props.type])
const messageClass = computed(() => messageClasses[props.type])
const actionClass = computed(() => actionClasses[props.type])
</script>
