<template>
  <UCard>
    <template #header>
      <div class="space-y-1">
        <h2 class="font-semibold text-highlighted">
          {{ $t('operations.webhooksTitle', { count: deliveries.total }) }}
        </h2>
        <p class="text-sm text-muted">{{ $t('operations.boundedList') }}</p>
      </div>
    </template>
    <p v-if="!deliveries.total" class="text-sm text-muted">{{ $t('operations.noWebhookFailures') }}</p>
    <ul v-else class="divide-y divide-default">
      <li v-for="delivery in deliveries.items" :key="delivery.id" class="min-w-0 space-y-2 py-3 first:pt-0 last:pb-0">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 space-y-1">
            <p class="break-words font-medium text-highlighted">{{ delivery.siteName }}</p>
            <p class="break-all text-xs text-muted">{{ delivery.event }} · {{ delivery.id }}</p>
          </div>
          <UBadge :color="delivery.status === 'FAILED' ? 'error' : 'warning'" variant="soft">{{
            $t(`operations.deliveryStatus.${delivery.status}`)
          }}</UBadge>
        </div>
        <p class="text-sm">{{ $t(`operations.reasons.${delivery.reason}`) }}</p>
        <p class="text-xs text-muted">
          {{ $t('operations.attempts', { count: delivery.attempts })
          }}<span v-if="delivery.statusCode"> · {{ $t('operations.httpStatus', { code: delivery.statusCode }) }}</span>
        </p>
        <p v-if="delivery.status === 'PENDING'" class="text-sm text-muted">
          {{ $t('operations.nextRetry') }} <AppTime :datetime="delivery.nextAttemptAt" preset="shortDatetime" />
        </p>
        <UButton
          v-if="delivery.canRetry"
          color="neutral"
          variant="soft"
          size="sm"
          icon="mdi:refresh"
          :loading="retrying === delivery.id"
          :disabled="retrying !== null"
          @click="retry(delivery.id)"
        >
          {{ $t('operations.retryDelivery') }}
        </UButton>
      </li>
    </ul>
    <p v-if="retryMessage" role="status" class="mt-3 text-sm text-muted">{{ retryMessage }}</p>
    <UAlert
      v-if="retryError"
      class="mt-3"
      color="error"
      icon="mdi:alert-circle-outline"
      :title="$t('operations.retryFailed')"
      :description="$t(`operations.${retryError}`)"
      role="alert"
    />
  </UCard>
</template>

<script setup lang="ts">
import type { OperationsOverview } from '~~/shared/types/operations'

defineProps<{ deliveries: OperationsOverview['webhooks'] }>()
const emit = defineEmits<{ retried: [] }>()
const { t } = useI18n()
const confirm = useConfirm()
const retrying = shallowRef<string | null>(null)
const retryError = shallowRef<'retryConflict' | 'retryRateLimited' | 'retryUnavailable' | null>(null)
const retryMessage = shallowRef('')

const retry = async (id: string) => {
  if (
    retrying.value ||
    !(await confirm({
      title: t('operations.retryDelivery'),
      message: t('operations.retryConfirm'),
      confirmText: t('operations.retryDelivery'),
      variant: 'danger',
    }))
  )
    return
  retrying.value = id
  retryError.value = null
  retryMessage.value = ''
  try {
    await $fetch<unknown, '/api/admin/webhook-deliveries/:id/retry'>(
      `/api/admin/webhook-deliveries/${id}/retry` as '/api/admin/webhook-deliveries/:id/retry',
      { method: 'POST', body: { confirmDuplicateRisk: true } },
    )
    retryMessage.value = t('operations.retryQueued')
    emit('retried')
  } catch (error) {
    const code = (error as { statusCode?: number }).statusCode
    retryError.value = code === 409 ? 'retryConflict' : code === 429 ? 'retryRateLimited' : 'retryUnavailable'
  } finally {
    retrying.value = null
  }
}
</script>
