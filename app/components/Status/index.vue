<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div
      class="p-8 md:p-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-md md:max-w-lg w-full transition-all duration-300 ease-in-out transform"
      :class="{ 'scale-95 opacity-0': !isMounted, 'scale-100 opacity-100': isMounted }"
    >
      <slot name="icon">
        <div class="flex justify-center relative">
          <NuxtImg
            v-if="showTopik404"
            src="/topik_404_rm.png"
            alt="404 Stránka nenalezena"
            class="w-32 h-32 mx-auto mb-4 object-contain"
            loading="lazy"
            placeholder
          />
          <div v-else-if="effectiveType === 'error'" class="relative">
            <Icon :name="iconName" class="w-12 h-12 mx-auto mb-4" :class="iconClass" aria-hidden="true" />
            <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-200 dark:bg-red-800 rounded-full"></span>
          </div>
          <div v-else-if="effectiveType === 'pending'" class="flex justify-center">
            <div
              class="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"
            ></div>
          </div>
          <Icon v-else :name="iconName" class="w-12 h-12 mx-auto mb-4" :class="iconClass" aria-hidden="true" />
        </div>
      </slot>
      <slot name="title">
        <h2 class="text-2xl font-semibold text-center" :class="titleClass">
          {{ computedTitle }}
        </h2>
      </slot>
      <slot name="message">
        <p class="text-center text-base mt-2" :class="messageClass">
          {{ computedMessage }}
        </p>
      </slot>
      <slot v-if="effectiveType === 'error' && stackTrace" name="stackTrace">
        <div class="mt-4 flex justify-between items-center">
          <Button
            class="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-all duration-200"
            @click="showStack = !showStack"
          >
            {{ showStack ? $t('common.actions.hideDetails') : $t('common.actions.showDetails') }}
          </Button>
          <button
            v-if="showStack"
            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            @click="copyStackTrace"
          >
            <Icon name="mdi:content-copy" class="w-5 h-5" />
          </button>
        </div>
        <div v-if="showStack" class="mt-2">
          <div
            class="text-sm text-gray-500 dark:text-gray-400 max-h-64 overflow-y-auto bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg font-mono leading-6"
          >
            <pre class="whitespace-pre-wrap">{{ formattedStackTrace }}</pre>
          </div>
        </div>
      </slot>
      <slot v-if="effectiveType !== 'pending'" name="action">
        <div v-if="props.actionText" class="mt-6 flex justify-center">
          <NuxtLink
            :to="props.actionTo"
            class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
            :class="actionClass"
            :aria-label="props.actionText"
          >
            {{ props.actionText }}
          </NuxtLink>
        </div>
      </slot>
      <slot v-if="effectiveType === 'pending'" name="skeleton">
        <div class="mt-6 space-y-3">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto animate-pulse"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto animate-pulse"></div>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AsyncDataRequestStatus } from 'nuxt/app'

const props = defineProps<{
  status?: AsyncDataRequestStatus
  type?: 'error' | 'pending' | 'success' | 'idle'
  message?: string
  title?: string
  actionText?: string
  actionTo?: string
  stackTrace?: string
  errorCode?: number
}>()

const isMounted = shallowRef(false)
const showStack = shallowRef(false)

onMounted(() => (isMounted.value = true))

const statusMap: Record<AsyncDataRequestStatus, 'error' | 'pending' | 'success' | 'idle'> = {
  idle: 'idle',
  pending: 'pending',
  success: 'success',
  error: 'error',
}

const effectiveType = computed(() => props.type || (props.status ? statusMap[props.status] : 'idle'))

const titles = {
  error: props.title || $t('common.error'),
  pending: $t('common.loading'),
  success: $t('common.messages.successGeneralTitle'),
  idle: $t('common.messages.idleTitle'),
} as const
const messages = {
  error: $t('common.error'),
  pending: $t('stats.loading'),
  success: $t('common.messages.successGeneral'),
  idle: $t('common.messages.idle'),
} as const
const icons = {
  error: 'mdi:alert-circle',
  pending: 'mdi:loading',
  success: 'mdi:check-circle',
  idle: 'mdi:pause-circle',
} as const
const errorIcons: Record<number, string> = {
  400: 'mdi:alert-octagon',
  401: 'mdi:lock-off',
  403: 'mdi:shield-off',
  404: 'mdi:map-marker-off',
  409: 'mdi:alert-decagram',
  422: 'mdi:file-alert',
  429: 'mdi:timer-off',
  500: 'mdi:server-off',
  503: 'mdi:cloud-alert',
  504: 'mdi:network-off',
  406: 'mdi:alert-box',
}
const iconClasses = {
  error: 'text-red-500 animate-pulse',
  pending: 'text-blue-600 animate-spin',
  success: 'text-green-500',
  idle: 'text-gray-400',
} as const
const titleClasses = {
  error: 'text-red-600 dark:text-red-400',
  pending: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  idle: 'text-gray-500 dark:text-gray-400',
} as const
const messageClasses = {
  error: 'text-gray-600 dark:text-gray-300',
  pending: 'text-gray-600 dark:text-gray-300',
  success: 'text-gray-600 dark:text-gray-300',
  idle: 'text-gray-500 dark:text-gray-400',
} as const
const actionClasses = {
  error: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800',
  pending: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
  success:
    'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800',
  idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
} as const

const computedTitle = computed(() => props.title || titles[effectiveType.value])
const computedMessage = computed(() => props.message || messages[effectiveType.value])
const iconName = computed(() =>
  effectiveType.value === 'error' && props.errorCode && props.errorCode !== 404
    ? errorIcons[props.errorCode] || icons.error
    : icons[effectiveType.value],
)
const iconClass = computed(() => iconClasses[effectiveType.value])
const titleClass = computed(() => titleClasses[effectiveType.value])
const messageClass = computed(() => messageClasses[effectiveType.value])
const actionClass = computed(() => actionClasses[effectiveType.value])
const showTopik404 = computed(() => effectiveType.value === 'error' && props.errorCode === 404)
const formattedStackTrace = computed(() => {
  if (!props.stackTrace) return ''
  return props.stackTrace
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line)
    .slice(0, 20)
    .join('\n')
})

const copyStackTrace = async () => {
  if (props.stackTrace) {
    await navigator.clipboard.writeText(props.stackTrace)
    useToast().success({ message: $t('common.actions.copySuccess') })
  }
}
</script>
