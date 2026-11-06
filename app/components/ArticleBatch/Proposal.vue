<template>
  <div class="flex flex-col gap-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-4">
    <ul class="divide-y divide-default" :aria-label="$t('articleBatch.proposal.listLabel')">
      <li v-for="row in rows" :key="row.id" class="flex items-start gap-3 py-3 first:pt-0">
        <UCheckbox
          v-model="row.selected"
          class="mt-2"
          :aria-label="$t('articleBatch.proposal.select', { topic: row.topic })"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <UInput
            v-model="row.topic"
            class="w-full"
            maxlength="300"
            :disabled="!row.selected"
            :aria-label="$t('articleBatch.proposal.editTopic')"
          />
          <p v-if="row.keyword" class="text-xs text-muted">
            {{ row.keyword }}
            <template v-if="row.volume"> · {{ $t('articleBatch.proposal.volume', { n: row.volume }) }}</template>
          </p>
          <p v-if="row.reason" class="text-xs text-muted">{{ row.reason }}</p>
        </div>
      </li>
      <li v-for="(topic, index) in customTopics" :key="`${index}:${topic}`" class="flex items-center gap-3 py-3">
        <UIcon name="mdi:pencil-outline" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <p class="min-w-0 flex-1 text-sm text-highlighted">{{ topic }}</p>
        <UButton
          square
          size="xs"
          color="neutral"
          variant="ghost"
          icon="mdi:close"
          :aria-label="$t('articleBatch.proposal.removeTopic', { topic })"
          @click="customTopics.splice(index, 1)"
        />
      </li>
    </ul>

    <div v-if="batch.proposing" class="space-y-2" role="status">
      <p class="text-sm text-muted">{{ $t('articleBatch.proposal.proposing') }}</p>
      <UProgress size="sm" :aria-label="$t('articleBatch.proposal.proposing')" />
    </div>
    <p v-else-if="fewerThanCredits" class="text-sm text-muted">
      {{ $t('articleBatch.proposal.fewer', { n: recommendedCount }, recommendedCount) }}
    </p>
    <p v-if="recommendedCount < rows.length" class="text-sm text-muted">
      {{ $t('articleBatch.proposal.weakNote') }}
    </p>

    <form class="flex gap-2" @submit.prevent="addTopic">
      <UInput
        v-model="newTopic"
        class="min-w-0 flex-1"
        maxlength="300"
        :placeholder="$t('articleBatch.proposal.addPlaceholder')"
        :aria-label="$t('articleBatch.proposal.addPlaceholder')"
      />
      <UButton type="submit" color="neutral" variant="soft" icon="mdi:plus" :disabled="!canAddTopic">
        {{ $t('articleBatch.proposal.add') }}
      </UButton>
    </form>

    <URadioGroup
      v-model="mode"
      :legend="$t('articleBatch.proposal.modeLegend')"
      :items="modeItems"
      variant="card"
      :ui="{ fieldset: 'grid gap-3 sm:grid-cols-2' }"
    />

    <div v-if="mode === 'SPREAD'" class="max-w-xs">
      <AppFormLabel :forId="paceId" :text="$t('articleBatch.proposal.paceLabel')" />
      <USelect :id="paceId" v-model="paceHours" class="mt-1 w-full" :items="paceItems" />
      <p class="mt-1 text-xs text-muted">{{ $t('articleBatch.proposal.duration', { days: durationDays }) }}</p>
    </div>
    <UAlert
      v-if="mode === 'SPREAD' && paceHours <= FAST_BATCH_PACE_HOURS"
      color="warning"
      variant="subtle"
      icon="mdi:alert-outline"
      :title="$t('articleBatch.proposal.fastPace')"
    />
    <UAlert
      v-if="cost > overview.credits.available"
      color="error"
      variant="subtle"
      icon="mdi:alert-circle-outline"
      :title="$t('articleBatch.errors.INSUFFICIENT_CREDITS')"
    />
    <UAlert
      v-else-if="cost > overview.credits.free"
      color="warning"
      variant="subtle"
      icon="mdi:alert-outline"
      :title="$t('articleBatch.proposal.overFree')"
    />

    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <UButton color="neutral" variant="ghost" :disabled="confirming" :loading="discarding" @click="discard">
        {{ $t('articleBatch.proposal.discard') }}
      </UButton>
      <UButton :disabled="!canConfirm" :loading="confirming" @click="approve">
        {{ $t('articleBatch.proposal.approve', { n: selectedCount, credits: cost }, selectedCount) }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const { batch, overview } = defineProps<{ batch: ArticleBatchView; overview: ArticleBatchOverview }>()
const emit = defineEmits<{ changed: [] }>()

type Row = ArticleBatchProposalRow & { selected: boolean }

const { t } = useI18n()
const toast = useToast()
const can = useTenantScope()
const paceId = useId()

const rows = ref<Row[]>([])
const customTopics = ref<string[]>([])
const newTopic = shallowRef('')
const canSpread = computed(() => overview.publishToWeb && can('ARTICLE_PUBLISH'))
// Whoever already lets the autopilot publish has agreed to that; everyone else reviews first.
const mode = shallowRef<'SPREAD' | 'DRAFTS'>(overview.autoRelease && canSpread.value ? 'SPREAD' : 'DRAFTS')
const paceHours = shallowRef<BatchPaceHours>(DEFAULT_BATCH_PACE_HOURS)
const confirming = shallowRef(false)
const discarding = shallowRef(false)

// The top-up changes the proposal while the client may already be editing it, so edited rows stay as they are.
watch(
  () => batch.proposal,
  (proposal) => {
    const current = new Set(proposal.map((row) => row.id))
    const known = new Set(rows.value.map((row) => row.id))
    rows.value = [
      ...rows.value.filter((row) => current.has(row.id)),
      ...proposal.filter((row) => !known.has(row.id)).map((row) => ({ ...row, selected: row.recommended })),
    ]
  },
  { immediate: true },
)

const selected = computed(() => rows.value.filter((row) => row.selected))
const selectedCount = computed(() => selected.value.length + customTopics.value.length)
const cost = computed(() => selectedCount.value * overview.credits.cost)
const durationDays = computed(() => Math.ceil((selectedCount.value * paceHours.value) / 24))
const canAddTopic = computed(() => newTopic.value.trim().length >= 3 && selectedCount.value < MAX_BATCH_ITEMS)
const canConfirm = computed(
  () =>
    selectedCount.value > 0 &&
    selectedCount.value <= MAX_BATCH_ITEMS &&
    cost.value <= overview.credits.available &&
    selected.value.every((row) => row.topic.trim().length >= 3) &&
    !discarding.value,
)
const recommendedCount = computed(() => rows.value.filter((row) => row.recommended).length)
const fewerThanCredits = computed(
  () =>
    recommendedCount.value <
    Math.min(
      MAX_BATCH_ITEMS,
      affordableArticleCount(overview.credits.free, overview.quality) ||
        affordableArticleCount(overview.credits.available, overview.quality),
    ),
)

const modeItems = computed(() => [
  {
    value: 'SPREAD' as const,
    label: t('articleBatch.mode.SPREAD.label'),
    description: t(canSpread.value ? 'articleBatch.mode.SPREAD.description' : 'articleBatch.mode.SPREAD.unavailable'),
    disabled: !canSpread.value,
  },
  {
    value: 'DRAFTS' as const,
    label: t('articleBatch.mode.DRAFTS.label'),
    description: t('articleBatch.mode.DRAFTS.description'),
  },
])
const paceItems = computed(() => BATCH_PACE_HOURS.map((value) => ({ value, label: t(`articleBatch.pace.${value}`) })))

const addTopic = () => {
  if (!canAddTopic.value) return
  customTopics.value.push(newTopic.value.trim())
  newTopic.value = ''
}

const approve = async () => {
  confirming.value = true
  try {
    await $fetch<unknown, string>(`/api/article-batches/${batch.id}/confirm`, {
      method: 'POST',
      body: {
        mode: mode.value,
        paceHours: paceHours.value,
        items: selected.value.map(({ id, topic }) => ({ id, topic: topic.trim() })),
        customTopics: customTopics.value,
      },
    })
    await refreshClientSiteStatus()
    toast.add({ color: 'success', title: t('articleBatch.proposal.approved') })
    emit('changed')
  } catch (error) {
    toast.add({ color: 'error', title: t(articleBatchErrorKey(error)) })
  } finally {
    confirming.value = false
  }
}

const discard = async () => {
  discarding.value = true
  try {
    await $fetch<unknown, string>(`/api/article-batches/${batch.id}/cancel`, { method: 'POST' })
    emit('changed')
  } catch (error) {
    toast.add({ color: 'error', title: t(articleBatchErrorKey(error)) })
  } finally {
    discarding.value = false
  }
}
</script>
