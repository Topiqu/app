<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div
      class="p-8 md:p-10 bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-md md:max-w-lg w-full"
    >
      <slot name="icon">
        <div class="flex justify-center mb-4">
          <NuxtImg v-if="showTopik404" src="/topik_404_rm.png" class="w-32 h-32 object-contain" loading="lazy" />
          <div v-else-if="effectiveType === 'error'" class="relative">
            <Icon :name="ui.icon!" class="w-12 h-12 mx-auto" :class="ui.classes.icon" aria-hidden="true" />
            <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-200 dark:bg-red-800 rounded-full"></span>
          </div>
          <Icon v-else :name="ui.icon!" class="w-12 h-12" :class="ui.classes.icon" aria-hidden="true" />
        </div>
      </slot>

      <slot name="title">
        <h2 class="text-2xl font-semibold text-center" :class="ui.classes.title">
          {{ ui.title }}
        </h2>
      </slot>

      <slot name="message">
        <p class="text-center text-base mt-2" :class="ui.classes.message">
          {{ ui.message }}
        </p>
      </slot>

      <slot v-if="effectiveType === 'error' && stackTrace" name="stackTrace">
        <div class="mt-4">
          <div class="flex justify-between items-center mb-2">
            <button
              class="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-all duration-200"
              @click="showStack = !showStack"
            >
              {{ showStack ? $t('common.actions.hideDetails') : $t('common.actions.showDetails') }}
            </button>
            <button
              v-if="showStack"
              class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              @click="copy()"
            >
              <Icon
                :name="copied ? 'mdi:check' : 'mdi:content-copy'"
                class="w-5 h-5"
                :class="{ 'text-green-500': copied }"
              />
            </button>
          </div>
          <div v-if="showStack" class="mt-2">
            <div
              class="text-sm text-gray-500 dark:text-gray-400 max-h-64 overflow-y-auto bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg font-mono leading-6"
            >
              <pre class="whitespace-pre-wrap">{{ stackTrace }}</pre>
            </div>
          </div>
        </div>
      </slot>

      <slot v-if="effectiveType !== 'pending'" name="action">
        <div v-if="actionText" class="mt-6 flex justify-center">
          <NuxtLink
            :to="actionTo"
            class="inline-flex items-center px-6 py-2 rounded-full text-sm font-medium transition-all duration-200"
            :class="ui.classes.action"
          >
            {{ actionText }}
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
const props = defineProps<{
  status?: 'idle' | 'pending' | 'success' | 'error'
  type?: 'error' | 'pending' | 'success' | 'idle'
  message?: string
  title?: string
  actionText?: string
  actionTo?: string
  stackTrace?: string
  errorCode?: number
}>()

const showStack = shallowRef(false)
const { copy, copied } = useClipboard({ source: computed(() => props.stackTrace ?? '') })

const effectiveType = computed(() => props.type || props.status || 'idle')
const showTopik404 = computed(() => effectiveType.value === 'error' && props.errorCode === 404)

const ui = computed(() => {
  const type = effectiveType.value

  return {
    title: props.title || $t(TITLES[type]),
    message: props.message || $t(MESSAGES[type]),
    icon:
      type === 'error' && props.errorCode && ERROR_ICONS[props.errorCode]
        ? ERROR_ICONS[props.errorCode]
        : DEFAULT_ICONS[type],
    classes: {
      icon: ICON_CLASSES[type],
      title: TITLE_CLASSES[type],
      message: MESSAGE_CLASSES[type],
      action: ACTION_CLASSES[type],
    },
  }
})

const TITLES = {
  error: 'common.error',
  pending: 'common.loading',
  success: 'common.messages.successGeneralTitle',
  idle: 'common.messages.idleTitle',
} as const

const MESSAGES = {
  error: 'common.error',
  pending: 'stats.loading',
  success: 'common.messages.successGeneral',
  idle: 'common.messages.idle',
} as const

const DEFAULT_ICONS = {
  error: 'mdi:alert-circle',
  pending: 'mdi:loading',
  success: 'mdi:check-circle',
  idle: 'mdi:pause-circle',
} as const

const ERROR_ICONS: Record<number, string> = {
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
}

const ICON_CLASSES = {
  error: 'text-red-500 animate-pulse',
  pending: 'text-blue-600 animate-spin',
  success: 'text-green-500',
  idle: 'text-gray-400',
} as const

const TITLE_CLASSES = {
  error: 'text-red-600 dark:text-red-400',
  pending: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  idle: 'text-gray-500 dark:text-gray-400',
} as const

const MESSAGE_CLASSES = {
  error: 'text-gray-600 dark:text-gray-300',
  pending: 'text-gray-600 dark:text-gray-300',
  success: 'text-gray-600 dark:text-gray-300',
  idle: 'text-gray-500 dark:text-gray-400',
} as const

const ACTION_CLASSES = {
  error: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800',
  pending: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
  success:
    'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800',
  idle: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
} as const
</script>
