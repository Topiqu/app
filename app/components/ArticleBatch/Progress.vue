<template>
  <div class="flex flex-col gap-4 rounded-(--topiqu-surface-radius) border border-default bg-default p-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p class="font-medium text-highlighted">{{ summary }}</p>
      <div v-if="active" class="flex gap-2">
        <UButton
          v-if="batch.pauseReason"
          size="sm"
          color="primary"
          variant="soft"
          :loading="resuming"
          @click="resumeBatch"
        >
          {{ $t('articleBatch.progress.resume') }}
        </UButton>
        <UButton size="sm" color="neutral" variant="ghost" :loading="cancelling" @click="cancelBatch">
          {{ $t('articleBatch.progress.cancel') }}
        </UButton>
      </div>
    </div>
    <UProgress
      v-if="active"
      :modelValue="finished"
      :max="batch.items.length"
      :aria-label="$t('articleBatch.progress.label')"
    />
    <UAlert
      v-if="batch.pauseReason"
      color="warning"
      variant="subtle"
      icon="mdi:pause-circle-outline"
      :title="$t(`articleBatch.progress.paused.${batch.pauseReason}`)"
    />
    <ul class="divide-y divide-default">
      <li
        v-for="item in batch.items"
        :key="item.id"
        class="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
      >
        <div class="min-w-0 flex-1">
          <p v-if="item.article" class="line-clamp-2 text-sm font-medium">
            <ULink :to="localePath({ name: 'admin-editor-id', params: { id: item.article.slug } })">
              {{ item.article.title }}
            </ULink>
          </p>
          <p v-else class="line-clamp-2 text-sm text-toned">{{ item.topic }}</p>
          <p v-if="dateOf(item)" class="text-xs text-muted">{{ formatTime(dateOf(item)!, 'short') }}</p>
        </div>
        <UBadge class="self-start sm:self-center" size="sm" variant="soft" :color="stateColor[stateOf(item)]">
          {{ $t(`articleBatch.progress.state.${stateOf(item)}`) }}
        </UBadge>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const { batch } = defineProps<{ batch: ArticleBatchView }>()
const emit = defineEmits<{ changed: [] }>()

type ItemState = 'queued' | 'running' | 'held' | 'scheduled' | 'published' | 'draft' | 'failed' | 'cancelled'

const stateColor: Record<ItemState, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  queued: 'neutral',
  running: 'info',
  held: 'warning',
  scheduled: 'info',
  published: 'success',
  draft: 'neutral',
  failed: 'error',
  cancelled: 'neutral',
}

const { t } = useI18n()
const { formatTime } = useTime()
const toast = useToast()
const confirm = useConfirm()
const localePath = useLocalePath()
const resuming = shallowRef(false)
const cancelling = shallowRef(false)

const active = computed(() => batch.status === 'ACTIVE')
const finished = computed(() => batch.items.filter((item) => !['QUEUED', 'RUNNING'].includes(item.status)).length)
const written = computed(() => batch.items.filter((item) => item.status === 'SUCCEEDED').length)
const summary = computed(() =>
  active.value
    ? t('articleBatch.progress.summaryActive', { done: written.value, total: batch.items.length })
    : t(
        batch.status === 'CANCELLED'
          ? 'articleBatch.progress.summaryCancelled'
          : 'articleBatch.progress.summaryFinished',
        { done: written.value, total: batch.items.length },
      ),
)

const stateOf = (item: ArticleBatchItemView): ItemState => {
  if (item.status === 'QUEUED') return 'queued'
  if (item.status === 'RUNNING') return 'running'
  if (item.status === 'FAILED') return 'failed'
  if (item.status === 'CANCELLED') return 'cancelled'
  if (item.article?.status === 'published') return 'published'
  if (item.article?.held) return 'held'
  return item.article?.releaseAt ? 'scheduled' : 'draft'
}

const dateOf = (item: ArticleBatchItemView) =>
  item.status === 'QUEUED' && batch.mode === 'SPREAD' ? item.scheduledFor : (item.article?.releaseAt ?? null)

const post = async (action: 'resume' | 'cancel') => {
  await $fetch<unknown, string>(`/api/article-batches/${batch.id}/${action}`, { method: 'POST' })
  emit('changed')
}

const resumeBatch = async () => {
  resuming.value = true
  try {
    await post('resume')
  } catch (error) {
    toast.add({ color: 'error', title: t(articleBatchErrorKey(error)) })
  } finally {
    resuming.value = false
  }
}

const cancelBatch = async () => {
  const confirmed = await confirm({
    title: t('articleBatch.progress.cancelTitle'),
    message: t('articleBatch.progress.cancelMessage'),
    confirmText: t('articleBatch.progress.cancel'),
    variant: 'danger',
  })
  if (!confirmed) return
  cancelling.value = true
  try {
    await post('cancel')
  } catch (error) {
    toast.add({ color: 'error', title: t(articleBatchErrorKey(error)) })
  } finally {
    cancelling.value = false
  }
}
</script>
