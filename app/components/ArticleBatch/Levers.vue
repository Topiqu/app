<template>
  <section v-if="canChange && hasLevers" class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div>
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('articleBatch.levers.title') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ $t('articleBatch.levers.description') }}</p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      <div
        v-if="quality"
        class="flex flex-col gap-3 rounded-(--topiqu-surface-radius) border border-default bg-default p-4"
      >
        <div class="min-w-0 flex-1">
          <h3 class="font-medium text-highlighted">
            {{ $t('articleBatch.levers.quality.title', { level: qualityLabel(quality) }) }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{
              $t('articleBatch.levers.quality.description', {
                articles: overview.credits.autopilotPerMonth,
                credits: overview.credits.autopilotPerMonth * articleCreditCost(quality),
                allowance: overview.credits.monthlyAllowance,
              })
            }}
          </p>
        </div>
        <UButton
          class="self-start"
          color="primary"
          variant="soft"
          :loading="saving === 'quality'"
          :disabled="saving !== null"
          @click="applyQuality(quality)"
        >
          {{ $t('articleBatch.levers.quality.apply', { level: qualityLabel(quality) }) }}
        </UButton>
      </div>
      <div
        v-if="interval"
        class="flex flex-col gap-3 rounded-(--topiqu-surface-radius) border border-default bg-default p-4"
      >
        <div class="min-w-0 flex-1">
          <h3 class="font-medium text-highlighted">{{ $t('articleBatch.levers.tempo.title') }}</h3>
          <p class="mt-1 text-sm text-muted">
            {{
              $t('articleBatch.levers.tempo.description', {
                articles: interval.perMonth,
                current: overview.credits.autopilotPerMonth,
              })
            }}
          </p>
          <p class="mt-1 text-xs text-muted">{{ $t('articleBatch.levers.tempo.note') }}</p>
        </div>
        <UButton
          class="self-start"
          color="neutral"
          variant="soft"
          :loading="saving === 'tempo'"
          :disabled="saving !== null"
          @click="applyTempo(interval)"
        >
          {{ $t('articleBatch.levers.tempo.apply') }}
        </UButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { overview } = defineProps<{ overview: ArticleBatchOverview }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()
const can = useTenantScope()
const headingId = useId()
const saving = shallowRef<'quality' | 'tempo' | null>(null)

const canChange = computed(() => can('TENANT_SETTINGS'))
const quality = computed(() => overview.recommended.quality)
const interval = computed(() => overview.recommended.interval)
const hasLevers = computed(() => Boolean(quality.value || interval.value))
const qualityLabel = (level: string) => t(`common.preferences.articleQuality.options.${level}`)

const patch = async (kind: 'quality' | 'tempo', body: Record<string, unknown>) => {
  saving.value = kind
  try {
    await $fetch<unknown, '/api/clients/:id'>(`/api/clients/${overview.clientSiteId}` as '/api/clients/:id', {
      method: 'PATCH',
      body,
    })
    await refreshClientSiteStatus()
    toast.add({ color: 'success', title: t('articleBatch.levers.saved') })
    emit('changed')
  } catch {
    toast.add({ color: 'error', title: t('articleBatch.errors.generic') })
  } finally {
    saving.value = null
  }
}

const applyQuality = (level: string) => patch('quality', { articleQuality: level })

const applyTempo = async (next: NonNullable<ArticleBatchOverview['recommended']['interval']>) => {
  const confirmed = await confirm({
    title: t('articleBatch.levers.tempo.confirmTitle'),
    message: t('articleBatch.levers.tempo.confirmMessage', { articles: next.perMonth }),
    confirmText: t('articleBatch.levers.tempo.apply'),
  })
  if (!confirmed) return
  await patch('tempo', {
    generationFrequency: 'INTERVAL',
    intervalMinHours: next.intervalMinHours,
    intervalMaxHours: next.intervalMaxHours,
  })
}
</script>
