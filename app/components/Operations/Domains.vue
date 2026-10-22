<template>
  <UCard>
    <template #header>
      <div class="space-y-1">
        <h2 class="font-semibold text-highlighted">{{ $t('operations.domainsTitle', { count: domains.total }) }}</h2>
        <p class="text-sm text-muted">{{ $t('operations.boundedList') }}</p>
      </div>
    </template>
    <p v-if="!domains.total" class="text-sm text-muted">{{ $t('operations.noDomainIssues') }}</p>
    <ul v-else class="divide-y divide-default">
      <li v-for="domain in domains.items" :key="domain.id" class="space-y-2 py-3 first:pt-0 last:pb-0">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="break-all font-medium text-highlighted">{{ domain.host }}</p>
            <p class="break-words text-xs text-muted">{{ domain.siteName }}</p>
          </div>
          <UBadge color="warning" variant="soft">{{ $t(`operations.domainStates.${domain.state}`) }}</UBadge>
        </div>
        <p class="text-sm">{{ $t(`operations.reasons.${domain.reason}`) }}</p>
        <p v-if="domain.checkedAt" class="text-xs text-muted">
          {{ $t('operations.checkedAt') }} <AppTime :datetime="domain.checkedAt" preset="shortDatetime" />
        </p>
        <UButton
          :to="localePath({ path: '/master', query: { query: domain.siteName } })"
          color="neutral"
          variant="soft"
          size="sm"
          icon="mdi:account-search-outline"
        >
          {{ $t('operations.reviewClient') }}
        </UButton>
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
import type { OperationsOverview } from '~~/shared/types/operations'

defineProps<{ domains: OperationsOverview['domains'] }>()
const localePath = useLocalePath()
</script>
