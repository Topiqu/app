<template>
  <section class="space-y-5" :aria-label="$t('operations.title')" :aria-busy="status === 'pending'">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">{{ $t('operations.title') }}</h1>
        <p class="max-w-prose text-sm text-muted">{{ $t('operations.description') }}</p>
        <p v-if="data" class="text-xs text-muted">
          {{ $t('operations.checkedAt') }} <AppTime :datetime="data.checkedAt" preset="shortDatetime" />
        </p>
      </div>
      <UButton color="neutral" variant="soft" icon="mdi:refresh" :loading="status === 'pending'" @click="refresh()">
        {{ $t('operations.refresh') }}
      </UButton>
    </div>
    <UAlert
      v-if="error"
      color="error"
      icon="mdi:alert-circle-outline"
      :title="$t('operations.loadFailed')"
      :description="$t('operations.loadFailedHelp')"
      role="alert"
    />
    <div v-if="data" class="space-y-5">
      <UAlert
        :color="data.cache === 'ready' ? 'success' : 'warning'"
        icon="mdi:database-outline"
        :title="$t(`operations.cache.${data.cache}`)"
        :description="$t(`operations.cacheHelp.${data.cache}`)"
      />
      <OperationsQueues :queues="data.queues" />
      <OperationsWebhooks :deliveries="data.webhooks" @retried="refresh()" />
      <OperationsDomains :domains="data.domains" />
      <OperationsTaskRuns :tasks="data.tasks" />
    </div>
    <USkeleton v-else-if="status === 'pending'" class="h-64 w-full" />
  </section>
</template>

<script setup lang="ts">
import type { OperationsOverview } from '~~/shared/types/operations'

const { data, error, status, refresh } = await useFetch<OperationsOverview>('/api/admin/operations', {
  key: 'master-operations',
})
</script>
