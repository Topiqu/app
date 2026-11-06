<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div>
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('articleBatch.plan.title') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ $t('articleBatch.plan.description') }}</p>
    </div>

    <ArticleBatchProposal
      v-if="batch?.status === 'PROPOSED'"
      :batch="batch"
      :overview="overview"
      @changed="emit('changed')"
    />
    <ArticleBatchProgress v-else-if="batch" :batch="batch" @changed="emit('changed')" />

    <div
      v-if="canStart && batch?.status !== 'PROPOSED' && batch?.status !== 'ACTIVE'"
      class="flex flex-col gap-3 rounded-(--topiqu-surface-radius) border border-dashed border-default p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-toned">
        {{ startHint }}
      </p>
      <template v-if="!overview.hasProfile">
        <UButton
          v-if="can('TENANT_SETTINGS')"
          class="shrink-0"
          color="neutral"
          variant="soft"
          icon="mdi:cog-outline"
          :to="localePath({ name: 'settings', query: { tab: 'content' } })"
        >
          {{ $t('articleBatch.plan.openSettings') }}
        </UButton>
      </template>
      <UButton
        v-else
        class="shrink-0"
        icon="mdi:star-four-points-outline"
        :loading="proposing"
        :disabled="!affordable"
        @click="propose"
      >
        {{ $t('articleBatch.plan.propose') }}
      </UButton>
    </div>
    <p v-else-if="!canStart && !batch" class="text-sm text-muted">{{ $t('articleBatch.plan.noPermission') }}</p>
  </section>
</template>

<script setup lang="ts">
const { overview } = defineProps<{ overview: ArticleBatchOverview }>()
const emit = defineEmits<{ changed: [] }>()

const { t } = useI18n()
const localePath = useLocalePath()
const toast = useToast()
const can = useTenantScope()
const headingId = useId()
const proposing = shallowRef(false)

const batch = computed(() => overview.batch)
const canStart = computed(() => can('AI_USE') && can('ARTICLE_WRITE') && can('ARTICLE_WRITE_OTHERS'))
const affordable = computed(() =>
  Math.min(
    MAX_BATCH_ITEMS,
    affordableArticleCount(overview.credits.free, overview.quality) ||
      affordableArticleCount(overview.credits.available, overview.quality),
  ),
)
const startHint = computed(() => {
  if (!overview.hasProfile) return t('articleBatch.errors.NO_PROFILE')
  return affordable.value
    ? t('articleBatch.plan.hint', { n: affordable.value }, affordable.value)
    : t('articleBatch.errors.NO_CREDITS')
})

const propose = async () => {
  proposing.value = true
  try {
    await $fetch<unknown, string>('/api/article-batches/proposal', { method: 'POST' })
    emit('changed')
  } catch (error) {
    toast.add({ color: 'error', title: t(articleBatchErrorKey(error)) })
  } finally {
    proposing.value = false
  }
}

// The AI top-up and the articles finish on the server; nothing else tells this page. A spread plan moves
// at most every few hours, so it only needs a slow refresh while someone keeps the page open.
const FAST_POLL_MS = 5_000
const SLOW_POLL_MS = 60_000
const visibility = useDocumentVisibility()
const live = computed(
  () => visibility.value === 'visible' && (Boolean(batch.value?.proposing) || batch.value?.status === 'ACTIVE'),
)
const pollEvery = computed(() =>
  batch.value?.proposing || (batch.value?.mode === 'DRAFTS' && !batch.value.pauseReason) ? FAST_POLL_MS : SLOW_POLL_MS,
)
const { pause, resume } = useIntervalFn(() => emit('changed'), pollEvery, { immediate: false })
watch(live, (running) => (running ? resume() : pause()), { immediate: true })
</script>
