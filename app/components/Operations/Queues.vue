<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold text-highlighted">{{ $t('operations.queuesTitle') }}</h2></template
    >
    <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="(count, name) in queues" :key="name" class="min-w-0 space-y-1">
        <dt class="text-sm text-muted">{{ $t(`operations.queues.${name}`) }}</dt>
        <dd class="text-2xl font-semibold tabular-nums text-highlighted">{{ count }}</dd>
      </div>
    </dl>
    <p class="mt-4 text-sm text-muted">{{ $t('operations.queuesHelp') }}</p>
  </UCard>
</template>

<script setup lang="ts">
import type { OperationsOverview } from '~~/shared/types/operations'

defineProps<{ queues: OperationsOverview['queues'] }>()
</script>
