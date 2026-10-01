<template>
  <section
    :aria-labelledby="headingId"
    class="overflow-hidden rounded-(--topiqu-surface-radius) border bg-default"
    :class="tone.border"
    data-generation-run
  >
    <div v-if="running" class="h-1 bg-primary/10" aria-hidden="true">
      <div
        class="h-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <header class="flex flex-wrap items-start gap-3 px-4 py-3">
      <span class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full" :class="tone.badge">
        <UIcon
          :name="tone.icon"
          size="18"
          :class="running ? 'animate-spin motion-reduce:animate-none' : ''"
          aria-hidden="true"
        />
      </span>
      <div class="min-w-48 flex-1" role="status">
        <h2 :id="headingId" class="font-semibold text-highlighted">
          {{ $t(`articles.editor.ai.run.title.${run.status}`) }}
        </h2>
        <p class="mt-0.5 text-xs leading-5 text-muted tabular-nums">
          <template v-if="running && authorName">{{ authorName }} · </template>
          {{ $t('articles.editor.ai.elapsed', { seconds: elapsed }) }}
          <template v-if="words"> · {{ $t('articles.editor.ai.run.words', { count: words }) }}</template>
        </p>
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <UButton
          v-if="running"
          size="sm"
          color="neutral"
          variant="soft"
          icon="mdi:stop-circle-outline"
          @click="emit('stop')"
        >
          {{ $t('articles.editor.ai.stopButton') }}
        </UButton>
        <template v-else>
          <UButton
            v-if="run.status !== 'completed'"
            size="sm"
            color="neutral"
            variant="soft"
            icon="mdi:refresh"
            @click="emit('retry')"
          >
            {{ $t('articles.editor.ai.run.retry') }}
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            icon="mdi:close"
            square
            :aria-label="$t('articles.editor.ai.run.dismiss')"
            @click="emit('dismiss')"
          />
        </template>
      </div>
    </header>

    <div
      v-if="run.error"
      class="mx-4 mb-3 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 text-sm"
      role="alert"
    >
      <p class="font-medium text-error">{{ run.error.message }}</p>
      <p v-if="run.error.creditReturned" class="mt-1 text-xs text-muted">
        {{ $t('articles.editor.ai.run.creditReturned') }}
      </p>
    </div>

    <ol class="flex flex-col border-t border-default/70 px-2 py-2">
      <li
        v-for="step in steps"
        :key="step.id"
        class="grid grid-cols-[1.75rem_1fr] gap-2 rounded-md px-2 py-2"
        :class="step.state === 'running' ? 'bg-elevated' : ''"
        :aria-current="step.state === 'running' ? 'step' : undefined"
      >
        <span class="grid size-7 place-items-center rounded-full border" :class="stepTone[step.state].class">
          <UIcon
            :name="stepTone[step.state].icon"
            size="15"
            :class="step.state === 'running' ? 'animate-spin motion-reduce:animate-none' : ''"
            aria-hidden="true"
          />
          <span class="sr-only">{{ $t(`articles.editor.ai.run.state.${step.state}`) }}</span>
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium" :class="step.state === 'pending' ? 'text-muted' : 'text-highlighted'">
            {{ $t(`articles.editor.ai.run.step.${step.id}`) }}
          </p>
          <p v-if="step.detail" class="mt-0.5 text-xs leading-5" :class="stepTone[step.state].text">
            {{ $t(`articles.editor.ai.run.${step.detail}`, step.params ?? {}) }}
          </p>
          <p v-else-if="step.state === 'failed' && run.error" class="mt-0.5 text-xs leading-5 text-error">
            {{ $t('articles.editor.ai.run.failedHere') }}
          </p>

          <ul v-if="step.id === 'knowledge' && knowledgeSources.length" class="mt-1.5 space-y-1">
            <li v-for="source in knowledgeSources" :key="source.id">
              <NuxtLink
                :to="localePath({ name: 'admin-knowledge', query: { source: source.id } })"
                target="_blank"
                class="inline-flex items-center gap-1.5 text-xs text-highlighted hover:underline"
              >
                <UIcon name="mdi:book-open-page-variant-outline" size="14" class="text-muted" aria-hidden="true" />
                {{ source.title }}
              </NuxtLink>
            </li>
          </ul>

          <a
            v-if="step.id === 'youtube' && youtube?.status === 'found'"
            :href="youtube.url"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <UIcon name="mdi:youtube" size="14" aria-hidden="true" />
            {{ $t('articles.editor.ai.run.openVideo') }}
          </a>

          <ul v-if="step.id === 'media' && mediaItems.length" class="mt-1.5 flex flex-wrap gap-1.5">
            <li
              v-for="item in mediaItems"
              :key="item.key"
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              :class="item.source ? 'border-default text-muted' : 'border-warning/30 text-warning'"
            >
              <span class="font-medium text-highlighted">{{ item.label }}</span>
              {{ $t(`articles.editor.ai.run.source.${item.source ?? 'missing'}`) }}
            </li>
          </ul>

          <ul
            v-if="step.id === 'review' && step.state === 'warning' && run.review?.issues?.length"
            class="mt-1.5 space-y-1 text-xs leading-5 text-muted"
          >
            <li v-for="(issue, index) in run.review.issues" :key="index">
              <span class="font-medium text-highlighted">{{ issueLabel(issue.code) }}:</span> {{ issue.note }}
            </li>
          </ul>

          <p v-if="step.id === 'modules'" class="mt-0.5 text-xs text-warning">
            {{ missingModuleLabels }}
          </p>
        </div>
      </li>
    </ol>

    <p v-if="stalledMessage" class="border-t border-default/70 px-4 py-2.5 text-xs leading-5 text-warning">
      {{ stalledMessage }}
    </p>
    <p
      v-else-if="running && run.reserved"
      class="border-t border-default/70 px-4 py-2.5 text-[11px] tabular-nums text-muted"
    >
      {{ $t('articles.editor.ai.reservedDuringRun', { count: run.reserved.toLocaleString() }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import {
  generationSteps,
  type ArticleGenerationModule,
  type GenerationRun,
  type GenerationStepState,
} from '~~/shared/utils/articleGeneration'

const { run, words, authorName } = defineProps<{
  run: GenerationRun
  words: number
  authorName?: string | null
}>()
const emit = defineEmits<{ stop: []; retry: []; dismiss: [] }>()

const { t, te } = useI18n()
const localePath = useLocalePath()
const headingId = useId()
const now = useNow({ interval: 1_000 })

const running = computed(() => run.status === 'running')
const steps = computed(() => generationSteps(run, words))
const progress = computed(() => {
  const settled = steps.value.filter((step) => step.state !== 'pending' && step.state !== 'running').length
  return Math.round(((settled + 0.5) / steps.value.length) * 100)
})
const elapsed = computed(() =>
  Math.max(0, Math.floor(((run.finishedAt ?? now.value.getTime()) - run.startedAt) / 1_000)),
)

const tone = computed(() => {
  switch (run.status) {
    case 'running':
      return { icon: 'mdi:loading', badge: 'bg-primary/10 text-primary', border: 'border-primary/30' }
    case 'completed':
      return { icon: 'mdi:check-decagram', badge: 'bg-success/10 text-success', border: 'border-success/30' }
    case 'failed':
      return { icon: 'mdi:alert-circle-outline', badge: 'bg-error/10 text-error', border: 'border-error/30' }
    default:
      return { icon: 'mdi:progress-alert', badge: 'bg-warning/10 text-warning', border: 'border-warning/30' }
  }
})

const stepTone: Record<GenerationStepState, { icon: string; class: string; text: string }> = {
  pending: { icon: 'mdi:circle-small', class: 'border-default text-muted', text: 'text-muted' },
  running: { icon: 'mdi:loading', class: 'border-primary/30 bg-primary/10 text-primary', text: 'text-muted' },
  done: { icon: 'mdi:check', class: 'border-success/30 bg-success/10 text-success', text: 'text-muted' },
  warning: { icon: 'mdi:alert-outline', class: 'border-warning/30 bg-warning/10 text-warning', text: 'text-warning' },
  failed: { icon: 'mdi:close', class: 'border-error/30 bg-error/10 text-error', text: 'text-error' },
  skipped: { icon: 'mdi:minus', class: 'border-default text-muted', text: 'text-muted' },
}

const knowledgeSources = computed(() => run.researchResult?.knowledgeSources ?? [])
const youtube = computed(() => run.researchResult?.youtube)

const mediaItems = computed(() => {
  const media = run.media
  if (!media || media.stage === 'failed') return []
  const items = []
  if (media.cover !== undefined)
    items.push({ key: 'cover', label: t('articles.editor.ai.run.cover'), source: media.cover })
  media.slots?.forEach((source, index) => {
    if (source !== undefined)
      items.push({ key: `slot-${index}`, label: t('articles.editor.ai.run.slot', { number: index + 1 }), source })
  })
  return items
})

const issueLabel = (code: string) =>
  te(`articles.editor.ai.run.issue.${code}`) ? t(`articles.editor.ai.run.issue.${code}`) : code

const missingModuleLabels = computed(() =>
  (run.missingModules ?? [])
    .filter((module): module is ArticleGenerationModule => module !== 'youtube' && module !== 'images')
    .map((module) => t(`articles.editor.ai.module.${module}`))
    .join(', '),
)

const stalledMessage = computed(() => {
  if (!running.value) return null
  const idle = Math.floor((now.value.getTime() - run.lastActivityAt) / 1_000)
  if (idle < 20) return null
  if (run.phase === 'research') return t('articles.editor.ai.waitingResearch')
  if (run.phase === 'images') return t('articles.editor.ai.waitingImages')
  return run.writingStage === 'review'
    ? t('articles.editor.ai.writingStage.review')
    : t('articles.editor.ai.waitingWriting', { seconds: idle })
})
</script>
