<template>
  <aside
    v-if="visible"
    class="fixed right-4 top-20 z-overlay w-[min(24rem,calc(100vw-2rem))] rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-4 shadow-lg"
    role="status"
    aria-live="polite"
    data-background-generation
  >
    <div class="flex items-start gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <UIcon :name="statusIcon" size="20" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-highlighted">{{ $t(`articles.editor.ai.run.title.${generation.run!.status}`) }}</p>
        <p v-if="generation.article.title" class="line-clamp-2 text-sm text-muted">{{ generation.article.title }}</p>
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
        @click="generation.clear()"
      />
    </div>
    <div class="mt-3">
      <UButton block color="primary" variant="soft" :to="generation.editorPath">
        {{ $t(running ? 'articles.editor.ai.run.returnToEditor' : 'articles.editor.ai.run.openResult') }}
      </UButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { generationSteps } from '~~/shared/utils/articleGeneration'

const route = useRoute()
const generation = useArticleGenerationStore()
const now = useNow({ interval: 1_000 })
// The editor that owns the run shows it itself.
const visible = computed(() => !!generation.run && route.path !== generation.editorPath)
const running = computed(() => generation.running)
const statusIcon = computed(() =>
  running.value
    ? 'mdi:progress-clock'
    : generation.run?.status === 'completed'
      ? 'mdi:check-circle-outline'
      : 'mdi:alert-circle-outline',
)
const currentStep = computed(
  () => generation.run && generationSteps(generation.run, 0).find((step) => step.state === 'running')?.id,
)
const elapsed = computed(() =>
  generation.run
    ? Math.max(0, Math.floor(((generation.run.finishedAt ?? now.value.getTime()) - generation.run.startedAt) / 1_000))
    : 0,
)
</script>
