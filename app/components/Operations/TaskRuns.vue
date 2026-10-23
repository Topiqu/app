<template>
  <UCard>
    <template #header>
      <div class="space-y-1">
        <h2 class="font-semibold text-highlighted">{{ $t('operations.tasksTitle') }}</h2>
        <p class="text-sm text-muted">{{ $t('operations.tasksHelp') }}</p>
      </div>
    </template>
    <ul class="divide-y divide-default">
      <li v-for="task in tasks" :key="task.name" class="space-y-2 py-3 first:pt-0 last:pb-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <code class="min-w-0 break-all text-sm text-highlighted">{{ task.name }}</code>
          <div class="flex flex-wrap gap-2">
            <UBadge :color="statusColor(task.status)" variant="soft">{{
              $t(`operations.status.${task.status}`)
            }}</UBadge>
            <UBadge v-if="task.overdue" color="warning" variant="soft">{{ $t('operations.overdue') }}</UBadge>
          </div>
        </div>
        <dl class="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="text-muted">{{ $t('operations.lastSuccess') }}</dt>
            <dd>
              <AppTime v-if="task.lastSucceededAt" :datetime="task.lastSucceededAt" preset="shortDatetime" /><span
                v-else
                >{{ $t('operations.notObserved') }}</span
              >
            </dd>
          </div>
          <div>
            <dt class="text-muted">{{ $t('operations.lastRun') }}</dt>
            <dd>
              <AppTime v-if="task.startedAt" :datetime="task.startedAt" preset="shortDatetime" /><span v-else>{{
                $t('operations.notObserved')
              }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">{{ $t('operations.interval') }}</dt>
            <dd>{{ $t('operations.minutes', { count: task.intervalMinutes }) }}</dd>
          </div>
          <div>
            <dt class="text-muted">{{ $t('operations.latestCounts') }}</dt>
            <dd>{{ task.processed ?? '—' }} / {{ task.failed ?? '—' }} / {{ task.skipped ?? '—' }}</dd>
          </div>
        </dl>
        <p v-if="task.failureCode" class="text-sm text-muted">{{ $t(`operations.taskFailure.${task.failureCode}`) }}</p>
        <p v-if="task.overdue" class="text-sm text-muted">{{ $t('operations.overdueHelp') }}</p>
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
import type { OperationsTask } from '~~/shared/types/operations'

defineProps<{ tasks: OperationsTask[] }>()
const statusColor = (status: TaskStatus) => {
  if (status === 'failed') return 'error'
  if (status === 'degraded') return 'warning'
  if (status === 'succeeded') return 'success'
  return 'neutral'
}
</script>
