<template>
  <div class="flex min-h-[100dvh] items-center justify-center px-4">
    <UCard class="w-full max-w-lg">
      <slot v-if="$slots.icon" name="icon" />
      <template v-if="effectiveType === 'pending'">
        <div class="space-y-4" aria-busy="true">
          <UProgress />
          <USkeleton class="h-6 w-3/4" />
          <USkeleton class="h-4 w-1/2" />
        </div>
      </template>

      <div v-else class="flex flex-col items-center gap-4 py-8 text-center">
        <span class="grid size-14 place-items-center rounded-full bg-elevated text-muted">
          <UIcon :name="statusIcon" size="28" aria-hidden="true" />
        </span>
        <div class="space-y-1">
          <h1 class="text-lg font-semibold text-highlighted">{{ statusTitle }}</h1>
          <p class="break-words text-sm text-muted">{{ statusMessage }}</p>
        </div>
        <UButton v-if="actionText" :to="actionTo" :color="statusColor">{{ actionText }}</UButton>
      </div>

      <div v-if="effectiveType === 'error' && stackTrace" class="mt-4">
        <USeparator />
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            :label="showStack ? $t('common.actions.hideDetails') : $t('common.actions.showDetails')"
            @click="showStack = !showStack"
          />
          <UButton
            v-if="showStack"
            color="neutral"
            variant="ghost"
            size="sm"
            square
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            :aria-label="$t('common.actions.copy')"
            @click="copy()"
          />
        </div>
        <UCard v-if="showStack" variant="subtle" class="mt-2 max-h-64 overflow-y-auto">
          <pre class="whitespace-pre-wrap text-sm text-muted">{{ stackTrace }}</pre>
        </UCard>
      </div>
    </UCard>
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
const statusTitle = computed(() => props.title || $t(TITLES[effectiveType.value]))
const statusMessage = computed(() => props.message || $t(MESSAGES[effectiveType.value]))
const statusColor = computed(() =>
  effectiveType.value === 'error' ? 'error' : effectiveType.value === 'success' ? 'success' : 'neutral',
)
const statusIcon = computed(() =>
  effectiveType.value === 'error' && props.errorCode && ERROR_ICONS[props.errorCode]
    ? ERROR_ICONS[props.errorCode]
    : DEFAULT_ICONS[effectiveType.value],
)

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
</script>
