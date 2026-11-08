<template>
  <section
    ref="panel"
    :aria-labelledby="headingId"
    class="overflow-hidden rounded-(--topiqu-surface-radius) border bg-default"
    :class="tone.border"
    data-generation-run
  >
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
        <h2 :id="headingId" class="font-semibold text-highlighted">{{ headline }}</h2>
        <p class="mt-0.5 text-xs leading-5 text-muted tabular-nums">
          <template v-if="running && authorName">{{ authorName }} · </template>
          {{ $t('articles.editor.ai.run.elapsed', { time }) }}
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
            v-if="run.status === 'completed'"
            size="sm"
            color="neutral"
            variant="ghost"
            :trailingIcon="summaryOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
            :aria-expanded="summaryOpen"
            @click="summaryOpen = !summaryOpen"
          >
            {{ $t(summaryOpen ? 'articles.editor.ai.run.hideSummary' : 'articles.editor.ai.run.showSummary') }}
          </UButton>
          <UButton
            v-else
            size="sm"
            color="neutral"
            variant="soft"
            icon="mdi:refresh"
            :disabled="retryDisabled"
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

    <template v-if="!collapsed">
      <ol
        class="grid gap-1.5 px-4 pb-3"
        :style="{ gridTemplateColumns: `repeat(${pipeline.length}, minmax(0, 1fr))` }"
        :aria-label="$t('articles.editor.ai.run.progress')"
      >
        <li
          v-for="step in pipeline"
          :key="step.id"
          class="min-w-0"
          :aria-current="step.state === 'running' ? 'step' : undefined"
        >
          <span class="relative block h-1 overflow-hidden rounded-full bg-accented">
            <span
              v-if="step.state === 'running' && stepProgress(step.id) === null"
              class="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary animate-run-sweep motion-reduce:animate-none"
            />
            <span
              v-else
              class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 motion-reduce:transition-none"
              :class="segment[step.state].bar"
              :style="{ width: step.state === 'running' ? `${stepProgress(step.id)}%` : segment[step.state].width }"
            />
          </span>
          <span class="mt-1.5 flex min-w-0 items-center gap-1 text-[11px] leading-4" :class="segment[step.state].text">
            <UIcon
              :name="segment[step.state].icon"
              size="12"
              class="shrink-0"
              :class="step.state === 'running' ? 'animate-spin motion-reduce:animate-none' : ''"
              aria-hidden="true"
            />
            <span class="truncate">{{ $t(`articles.editor.ai.run.step.${step.id}`) }}</span>
            <span class="sr-only">{{ $t(`articles.editor.ai.run.state.${step.state}`) }}</span>
          </span>
        </li>
      </ol>

      <div
        v-if="running && activeSteps.length"
        class="mx-4 mb-3 rounded-md border border-default bg-elevated/40 px-3 py-2.5"
      >
        <template v-if="activeSteps[0]?.id === 'writing' && outline.length">
          <p class="text-xs leading-5 text-muted">{{ $t('articles.editor.ai.run.outline') }}</p>
          <ol class="mt-1.5 space-y-1">
            <li
              v-for="(heading, index) in outline"
              :key="`${index}-${heading}`"
              class="editorial-enter flex min-w-0 items-center gap-2 text-sm"
            >
              <UIcon
                :name="index === outline.length - 1 ? 'mdi:pencil-outline' : 'mdi:check'"
                size="14"
                class="shrink-0"
                :class="index === outline.length - 1 ? 'text-primary' : 'text-success'"
                aria-hidden="true"
              />
              <span class="truncate" :class="index === outline.length - 1 ? 'text-highlighted' : 'text-muted'">
                {{ heading }}
              </span>
              <span v-if="index === outline.length - 1" class="shrink-0 text-xs text-muted">
                · {{ $t('articles.editor.ai.run.writingNow') }}
              </span>
            </li>
          </ol>
        </template>
        <ol v-else-if="activeSteps[0]?.id === 'review' && reviewStages.length" class="space-y-1">
          <li
            v-for="(stage, index) in reviewStages"
            :key="stage"
            class="editorial-enter flex items-start gap-2 text-xs leading-5"
          >
            <UIcon
              :name="index === reviewStages.length - 1 ? 'mdi:loading' : 'mdi:check'"
              size="14"
              class="mt-0.5 shrink-0"
              :class="
                index === reviewStages.length - 1
                  ? 'animate-spin text-primary motion-reduce:animate-none'
                  : 'text-success'
              "
              aria-hidden="true"
            />
            <span :class="index === reviewStages.length - 1 ? 'text-highlighted' : 'text-muted'">
              {{ $t(`articles.editor.ai.run.review.${stage}`) }}
            </span>
          </li>
        </ol>
        <ul v-else class="space-y-1">
          <li v-for="step in activeSteps" :key="step.id" class="text-xs leading-5 text-muted">
            <template v-if="step.detail">{{ $t(`articles.editor.ai.run.${step.detail}`, step.params ?? {}) }}</template>
          </li>
        </ul>
        <p v-if="stalledMessage" class="mt-1.5 text-xs leading-5 text-warning">{{ stalledMessage }}</p>
      </div>

      <dl v-if="!running && stats.length" class="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4">
        <div
          v-for="stat in stats"
          :key="stat.key"
          class="flex flex-col-reverse rounded-md border px-3 py-2"
          :class="stat.warn ? 'border-warning/40' : 'border-default'"
        >
          <dt class="text-[11px] leading-4 text-muted">{{ stat.label }}</dt>
          <dd class="text-lg font-semibold tabular-nums" :class="stat.warn ? 'text-warning' : 'text-highlighted'">
            {{ stat.value }}
          </dd>
        </div>
      </dl>

      <ul v-if="mediaTiles.length" class="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-3">
        <li v-for="tile in mediaTiles" :key="tile.key" class="min-w-0">
          <AppMedia
            v-if="tile.url"
            :src="tile.url"
            alt=""
            aspectRatio="16 / 9"
            sizes="xs:50vw sm:240px"
            containerClass="rounded-md border border-default"
          />
          <div
            v-else
            class="grid aspect-video place-items-center rounded-md border border-dashed"
            :class="tile.source === null ? 'border-warning/50 text-warning' : 'border-default text-muted'"
          >
            <UIcon
              :name="
                tile.source === null
                  ? 'mdi:image-off-outline'
                  : running && !tile.source
                    ? 'mdi:loading'
                    : 'mdi:image-outline'
              "
              size="20"
              :class="running && tile.source === undefined ? 'animate-spin motion-reduce:animate-none' : ''"
              aria-hidden="true"
            />
          </div>
          <div class="mt-1 flex min-h-6 items-center justify-between gap-1">
            <p class="min-w-0 truncate text-[11px] leading-4">
              <span class="font-medium text-highlighted">{{ tile.label }}</span>
              <span v-if="tile.source !== undefined" class="text-muted">
                · {{ $t(`articles.editor.ai.run.source.${tile.source ?? 'missing'}`) }}
              </span>
            </p>
            <UButton
              v-if="!running && tile.url"
              size="xs"
              color="neutral"
              variant="ghost"
              square
              icon="mdi:crosshairs-gps"
              :aria-label="$t('articles.editor.ai.run.action.show', { label: tile.label })"
              @click="showTile(tile)"
            />
          </div>
        </li>
      </ul>

      <section v-if="todos.length" class="border-t border-default/70 px-4 py-3" :aria-labelledby="todoId">
        <h3 :id="todoId" class="text-sm font-semibold text-highlighted">
          {{ $t('articles.editor.ai.run.todo.title') }}
        </h3>
        <ul class="mt-2 space-y-3">
          <li v-for="todo in todos" :key="todo.key" class="flex flex-wrap items-start gap-x-3 gap-y-1.5">
            <UIcon
              :name="todo.failed ? 'mdi:close-circle-outline' : 'mdi:alert-circle-outline'"
              size="16"
              class="mt-0.5 shrink-0"
              :class="todo.failed ? 'text-error' : 'text-warning'"
              aria-hidden="true"
            />
            <div class="min-w-48 flex-1">
              <p class="text-sm font-medium text-highlighted">{{ todo.title }}</p>
              <p v-if="todo.note" class="text-xs leading-5 text-muted">{{ todo.note }}</p>
              <ul v-if="todo.key === 'review'" class="mt-1 space-y-1 text-xs leading-5 text-muted">
                <li v-for="(issue, index) in run.review?.issues ?? []" :key="index">
                  <span class="font-medium text-highlighted">{{ issueLabel(issue.code) }}:</span> {{ issueNote(issue) }}
                </li>
              </ul>
            </div>
            <UButton
              v-if="todo.action"
              size="xs"
              color="neutral"
              variant="soft"
              :icon="todo.action.icon"
              :disabled="running"
              @click="todo.action.run"
            >
              {{ todo.action.label }}
            </UButton>
          </li>
        </ul>
      </section>

      <div
        v-if="settledSteps.length || researchSources.length || knowledgeSources.length || video"
        class="flex flex-col gap-1.5 border-t border-default/70 px-4 py-2.5 text-xs leading-5"
      >
        <p v-if="!running && settledSteps.length" class="text-muted">
          <UIcon name="mdi:check" size="14" class="mr-1 inline-block align-[-2px] text-success" aria-hidden="true" />
          <span class="font-medium text-success">{{ $t('articles.editor.ai.run.done') }}:</span>
          {{ settledSteps.join(' · ') }}
        </p>
        <UCollapsible v-if="researchSources.length" v-model:open="researchSourcesOpen" class="min-w-0">
          <UButton
            color="neutral"
            variant="link"
            size="xs"
            icon="mdi:web"
            :label="$t('articles.editor.ai.run.research.sources', { count: run.researchResult?.sourceCount ?? 0 })"
            :trailingIcon="researchSourcesOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
            class="max-w-full"
          />
          <template #content>
            <ArticleSourceList :sources="researchSources" class="mt-2 max-h-72 overflow-y-auto" />
          </template>
        </UCollapsible>
        <ul v-if="knowledgeSources.length" class="flex flex-wrap gap-x-3 gap-y-1">
          <li v-for="source in knowledgeSources" :key="source.id" class="min-w-0">
            <NuxtLink
              :to="localePath({ name: 'admin-knowledge', query: { source: source.id } })"
              target="_blank"
              class="inline-flex max-w-full items-center gap-1.5 text-highlighted hover:underline"
            >
              <UIcon
                name="mdi:book-open-page-variant-outline"
                size="14"
                class="shrink-0 text-muted"
                aria-hidden="true"
              />
              <span class="truncate">{{ source.title }}</span>
            </NuxtLink>
          </li>
        </ul>
        <a
          v-if="video"
          :href="video.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <UIcon name="mdi:youtube" size="14" aria-hidden="true" />
          {{ $t('articles.editor.ai.run.openVideo') }}
        </a>
      </div>

      <p
        v-if="running && run.reserved"
        class="border-t border-default/70 px-4 py-2.5 text-[11px] tabular-nums text-muted"
      >
        {{ $t('articles.editor.ai.reservedDuringRun', { count: run.reserved.toLocaleString() }) }}
      </p>
    </template>

    <Teleport v-if="running && !inView" to="body">
      <div
        class="fixed bottom-4 left-1/2 z-40 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-full border border-default bg-default/95 py-1.5 pr-1.5 pl-4 shadow-lg backdrop-blur"
        data-generation-run-bar
      >
        <UIcon
          name="mdi:loading"
          size="16"
          class="shrink-0 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p class="min-w-0 flex-1 truncate text-sm">
          <span class="font-medium text-highlighted">{{ headline }}</span>
          <span class="text-muted tabular-nums"> · {{ time }}</span>
        </p>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="mdi:arrow-up"
          :label="$t('articles.editor.ai.run.show')"
          @click="panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="mdi:stop-circle-outline"
          square
          :aria-label="$t('articles.editor.ai.stopButton')"
          @click="emit('stop')"
        />
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import type { GenerationRun, GenerationStepId, GenerationReviewStage } from '~~/shared/utils/articleGeneration'

const {
  run,
  words,
  authorName,
  retryDisabled,
  outline = [],
  canVerify = false,
} = defineProps<{
  run: GenerationRun
  words: number
  authorName?: string | null
  retryDisabled?: boolean
  /** H2 headings streamed so far. */
  outline?: string[]
  canVerify?: boolean
}>()
const emit = defineEmits<{
  stop: []
  retry: []
  dismiss: []
  verify: []
  fillImage: [after: string | null]
  addVideo: [url?: string]
  showImage: [url: string]
  showCover: []
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const headingId = useId()
const todoId = useId()
const panel = useTemplateRef<HTMLElement>('panel')
const { now, pause, resume } = useNow({
  controls: true,
  scheduler: (callback) => useIntervalFn(callback, 1_000, { immediate: false }),
})

const running = computed(() => run.status === 'running')
watch(
  running,
  (active) => {
    if (!active) return pause()
    now.value = new Date()
    resume()
  },
  { immediate: true },
)

// The compact bar stands in for the panel once the author scrolls down to watch the text arrive.
const inView = shallowRef(true)
useIntersectionObserver(panel, ([entry]) => {
  inView.value = entry?.isIntersecting ?? true
})

const summaryOpen = shallowRef(false)
const collapsed = computed(() => run.status === 'completed' && !summaryOpen.value)

const steps = computed(() => generationSteps(run, words))
const pipeline = computed(() => steps.value.filter((step) => step.id !== 'modules'))
const activeSteps = computed(() => steps.value.filter((step) => step.state === 'running'))

const elapsed = computed(() =>
  Math.max(0, Math.floor(((run.finishedAt ?? now.value.getTime()) - run.startedAt) / 1_000)),
)
const time = computed(() => `${Math.floor(elapsed.value / 60)}:${String(elapsed.value % 60).padStart(2, '0')}`)

const REVIEW_STAGES: GenerationReviewStage[] = ['verifying', 'checking', 'revising', 'rechecking']
const reviewStages = computed(() =>
  run.reviewStage ? REVIEW_STAGES.slice(0, REVIEW_STAGES.indexOf(run.reviewStage) + 1) : [],
)

/** A known share of a running step; `null` sweeps instead. */
const stepProgress = (id: GenerationStepId) => {
  if (id === 'media' && run.media?.total) return Math.round((run.media.completed / run.media.total) * 100)
  if (id === 'review' && run.reviewStage) return ((REVIEW_STAGES.indexOf(run.reviewStage) + 0.5) / 4) * 100
  return null
}

const segment: Record<GenerationStepState, { icon: string; bar: string; width: string; text: string }> = {
  pending: { icon: 'mdi:circle-small', bar: '', width: '0%', text: 'text-muted' },
  running: { icon: 'mdi:loading', bar: 'bg-primary', width: '0%', text: 'font-medium text-highlighted' },
  done: { icon: 'mdi:check', bar: 'bg-success', width: '100%', text: 'text-default' },
  warning: { icon: 'mdi:alert-outline', bar: 'bg-warning', width: '100%', text: 'text-warning' },
  failed: { icon: 'mdi:close', bar: 'bg-error', width: '100%', text: 'text-error' },
  skipped: { icon: 'mdi:minus', bar: '', width: '0%', text: 'text-dimmed' },
}

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

const knowledgeSources = computed(() => run.researchResult?.knowledgeSources ?? [])
const researchSources = computed(() => run.researchResult?.sources ?? [])
const researchSourcesOpen = shallowRef(false)
const video = computed(() => {
  const youtube = run.researchResult?.youtube
  return youtube?.status === 'found' && !run.missingModules?.includes('youtube') ? youtube : null
})

const mediaTiles = computed(() => {
  const media = run.media
  if (!media || media.stage === 'failed' || !media.total) return []
  return [
    { key: 'cover', label: t('articles.editor.ai.run.cover'), source: media.cover, url: media.coverUrl },
    ...(media.slots ?? []).map((source, index) => ({
      key: `slot-${index}`,
      label: t('articles.editor.ai.run.slot', { number: index + 1 }),
      source,
      url: media.slotUrls?.[index],
    })),
  ]
})

const showTile = ({ key, url }: { key: string; url?: string | null }) => {
  if (key === 'cover') emit('showCover')
  else if (url) emit('showImage', url)
}

const stats = computed(() => {
  const result = run.researchResult
  const review = run.review
  const media = run.media
  const list: { key: string; label: string; value: string | number; warn: boolean }[] = []
  if (run.research)
    list.push({
      key: 'web',
      label: t('articles.editor.ai.run.stats.web'),
      value: result?.sourceCount ?? 0,
      warn: result?.status !== 'completed',
    })
  if (run.useKnowledge)
    list.push({
      key: 'knowledge',
      label: t('articles.editor.ai.run.stats.knowledge'),
      value: result?.knowledgeSourceCount ?? 0,
      warn: false,
    })
  if (review)
    list.push(
      review.approved
        ? {
            key: 'review',
            label: t('articles.editor.ai.run.stats.fixes'),
            value: review.resolvedIssues?.length ?? 0,
            warn: false,
          }
        : {
            key: 'review',
            label: t('articles.editor.ai.run.stats.open'),
            value: review.issues?.filter((issue) => issue.blocking !== false).length ?? 0,
            warn: true,
          },
    )
  if (media?.total)
    list.push({
      key: 'media',
      label: t('articles.editor.ai.run.stats.images'),
      value: media.stage === 'failed' ? '—' : `${media.found}/${media.total}`,
      warn: media.stage === 'failed' || media.found < media.total,
    })
  return list
})

type Todo = {
  key: string
  title: string
  note?: string
  failed?: boolean
  action?: { label: string; icon: string; run: () => void }
}

const detailText = (step: { detail: string | null; params?: Record<string, string | number> }) =>
  step.detail ? t(`articles.editor.ai.run.${step.detail}`, step.params ?? {}) : ''

const todos = computed(() => {
  const list: Todo[] = []
  for (const step of steps.value) {
    if (step.state !== 'warning' && step.state !== 'failed') continue
    if (step.id === 'research')
      list.push({
        key: 'research',
        title: detailText(step) || t('articles.editor.ai.run.failedHere'),
        note: t('articles.editor.ai.run.todo.verifyNote'),
        failed: step.state === 'failed',
        action: canVerify
          ? {
              label: t('articles.editor.ai.run.action.verify'),
              icon: 'mdi:shield-check-outline',
              run: () => emit('verify'),
            }
          : undefined,
      })
    else if (step.id === 'youtube') {
      const found = run.researchResult?.youtube
      list.push({
        key: 'youtube',
        title: detailText(step),
        action: {
          label: t('articles.editor.ai.run.action.addVideo'),
          icon: 'mdi:youtube',
          run: () => emit('addVideo', found?.status === 'found' ? found.url : undefined),
        },
      })
    } else if (step.id === 'review')
      list.push({ key: 'review', title: detailText(step), failed: step.state === 'failed' })
    else if (step.id === 'media' && run.media?.stage === 'failed')
      list.push({ key: 'media', title: detailText(step), failed: true })
    else if (step.id === 'modules')
      list.push({
        key: 'modules',
        title: `${t('articles.editor.ai.run.modules.missing')} ${missingModuleLabels.value}`,
      })
    else if (step.state === 'failed')
      list.push({
        key: step.id,
        title: t(`articles.editor.ai.run.step.${step.id}`),
        note: t('articles.editor.ai.run.failedHere'),
        failed: true,
      })
  }
  const media = run.media
  if (media?.stage === 'complete' && media.cover === null)
    list.push({
      key: 'cover',
      title: t('articles.editor.ai.run.todo.coverMissing'),
      action: {
        label: t('articles.editor.ai.run.action.pickCover'),
        icon: 'mdi:image-edit-outline',
        run: () => emit('showCover'),
      },
    })
  for (const gap of media?.gaps ?? [])
    list.push({
      key: `gap-${gap.slot}`,
      title: t('articles.editor.ai.run.todo.imageMissing', { number: gap.slot }),
      note: t('articles.editor.ai.run.todo.searched', { query: gap.query }),
      action: {
        label: t('articles.editor.ai.run.action.pickImage'),
        icon: 'mdi:image-plus-outline',
        run: () => emit('fillImage', gap.after),
      },
    })
  return list
})

const settledSteps = computed(() =>
  steps.value.filter((step) => step.state === 'done').map((step) => t(`articles.editor.ai.run.step.${step.id}`)),
)

const headline = computed(() => {
  const active = activeSteps.value[0]
  if (running.value)
    return active ? t(`articles.editor.ai.run.now.${active.id}`) : t('articles.editor.ai.run.title.running')
  if (run.status === 'partial' && todos.value.length)
    return t('articles.editor.ai.run.attention', { count: todos.value.length })
  return t(`articles.editor.ai.run.title.${run.status}`)
})

const { issueLabel, issueNote } = useReviewIssueText()

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
    ? t('articles.editor.ai.run.review.waiting', { seconds: idle })
    : t('articles.editor.ai.waitingWriting', { seconds: idle })
})
</script>
