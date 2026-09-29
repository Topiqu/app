<template>
  <aside
    v-if="activity"
    class="fixed bottom-20 right-4 z-overlay w-[min(24rem,calc(100vw-2rem))] rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-4 shadow-lg"
    role="status"
    aria-live="polite"
    data-background-generation
  >
    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <UIcon :name="statusIcon" size="20" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-highlighted">{{ $t(`articles.editor.ai.run.title.${activity.run.status}`) }}</p>
        <p v-if="activity.title" class="truncate text-sm text-muted">{{ activity.title }}</p>
        <p class="mt-1 text-sm text-muted">
          <template v-if="running && currentStep">{{ $t(`articles.editor.ai.run.step.${currentStep}`) }} · </template>
          {{ $t('articles.editor.ai.elapsed', { seconds: elapsed }) }}
        </p>
      </div>
      <UButton
        v-if="!running"
        color="neutral"
        variant="ghost"
        icon="mdi:close"
        square
        :aria-label="$t('articles.editor.ai.run.hideStatus')"
        @click="activity = null"
      />
    </div>
    <div class="mt-3">
      <UButton block color="primary" variant="soft" :to="activity.editorPath">
        {{ $t(running ? 'articles.editor.ai.run.returnToEditor' : 'articles.editor.ai.run.openResult') }}
      </UButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { generationSteps } from '~~/shared/utils/articleGeneration'

const activity = useBackgroundArticleGeneration()
const now = useNow({ interval: 1_000 })
const running = computed(() => activity.value?.run.status === 'running')
const statusIcon = computed(() =>
  running.value
    ? 'mdi:progress-clock'
    : activity.value?.run.status === 'completed'
      ? 'mdi:check-circle-outline'
      : 'mdi:alert-circle-outline',
)
const currentStep = computed(
  () => activity.value && generationSteps(activity.value.run, 0).find((step) => step.state === 'running')?.id,
)
const elapsed = computed(() =>
  activity.value
    ? Math.max(
        0,
        Math.floor(((activity.value.run.finishedAt ?? now.value.getTime()) - activity.value.run.startedAt) / 1_000),
      )
    : 0,
)
</script>
