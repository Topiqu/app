<template>
  <UTooltip v-if="visible" :text="$t('articles.editor.activityTitle')">
    <UChip :text="activeCount" :show="activeCount > 0" color="info" size="sm" inset>
      <UButton
        color="neutral"
        variant="soft"
        icon="mdi:progress-clock"
        square
        :aria-label="$t('articles.editor.activityTitle')"
        data-background-generation
        @click="open = true"
      />
    </UChip>
  </UTooltip>
  <USlideover v-model:open="open" :title="$t('articles.editor.activityTitle')">
    <template #body>
      <p class="mb-5 text-sm text-muted">{{ $t('articles.editor.backgroundTasksHelp') }}</p>
      <div v-if="generation.run" class="rounded-lg border border-default p-4">
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <UIcon :name="statusIcon" size="20" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">
              {{ $t(`articles.editor.ai.run.title.${generation.run!.status}`) }}
            </p>
            <p v-if="generation.article.title" class="line-clamp-2 text-sm text-muted">
              {{ generation.article.title }}
            </p>
            <p class="mt-1 text-sm text-muted">
              <template v-if="running && currentStep"
                >{{ $t(`articles.editor.ai.run.step.${currentStep}`) }} ·
              </template>
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
          <UButton block color="primary" variant="soft" :to="generation.editorPath" @click="open = false">
            {{ $t(running ? 'articles.editor.ai.run.returnToEditor' : 'articles.editor.ai.run.openResult') }}
          </UButton>
          <UButton
            v-if="running"
            class="mt-2"
            color="error"
            variant="ghost"
            size="sm"
            :loading="generation.stopRequested"
            @click="generation.requestStop()"
            >{{ $t('articles.editor.ai.stopButton') }}</UButton
          >
        </div>
      </div>
      <ul class="mt-4 space-y-3">
        <li v-for="task in otherTasks" :key="task.id" class="rounded-lg border border-default p-4">
          <div class="flex items-start gap-3">
            <UIcon
              :name="task.kind === 'translation' ? 'mdi:translate' : 'mdi:creation-outline'"
              class="mt-0.5 size-5 shrink-0 text-muted"
            />
            <div class="min-w-0 flex-1">
              <p class="line-clamp-2 text-sm font-medium text-highlighted">
                {{ task.title || $t('articles.addArticle') }}
              </p>
              <p class="mt-1 text-xs text-muted">
                {{
                  $t(
                    task.kind === 'translation'
                      ? 'articles.translations.languageTabs'
                      : 'articles.editor.generationTask',
                  )
                }}
                <template v-if="task.language"> · {{ $t(`languages.${task.language}`) }}</template>
              </p>
            </div>
            <UBadge
              :color="task.status === 'failed' ? 'error' : task.status === 'running' ? 'info' : 'neutral'"
              size="sm"
              variant="soft"
            >
              {{ $t(`articles.editor.activityStatus.${task.status}`) }}
            </UBadge>
          </div>
          <UProgress
            v-if="task.status === 'running'"
            class="mt-3"
            :aria-label="$t('articles.editor.activityStatus.running')"
          />
          <div class="mt-3 flex items-center gap-2">
            <UButton color="neutral" variant="soft" size="sm" :to="taskPath(task)" @click="open = false">{{
              $t('common.actions.view')
            }}</UButton>
            <UButton
              v-if="task.kind === 'generation' && task.status === 'running'"
              color="error"
              variant="ghost"
              size="sm"
              :loading="stopping === task.id"
              :disabled="Boolean(stopping)"
              @click="stopTask(task.id)"
              >{{ $t('articles.editor.ai.stopButton') }}</UButton
            >
          </div>
        </li>
      </ul>
      <p v-if="!generation.run && !otherTasks.length" class="py-8 text-center text-sm text-muted">
        {{ $t('articles.editor.activityEmpty') }}
      </p>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
const route = useRoute()
const localePath = useLocalePath()
const open = shallowRef(false)
const stopping = shallowRef<string | null>(null)
const toast = useToast()
const { t } = useI18n()
const visibility = useDocumentVisibility()
const can = useTenantScope()
const generation = useArticleGenerationStore()
const {
  data: tasks,
  refresh,
  status: taskStatus,
} = useLazyFetch<ArticleBackgroundTask[]>('/api/articles/activity', {
  server: false,
  default: () => [],
  getCachedData: () => undefined,
  immediate: can('ARTICLE_WRITE'),
})
const { pause: pauseTasks, resume: resumeTasks } = useIntervalFn(
  () => {
    if (taskStatus.value !== 'pending') void refresh({ dedupe: 'defer' }).catch(() => undefined)
  },
  5000,
  { immediate: false },
)
watch(
  () => visibility.value === 'visible' && can('ARTICLE_WRITE'),
  (visible) => (visible ? resumeTasks() : pauseTasks()),
  { immediate: true },
)
const otherTasks = computed(() => tasks.value.filter((task) => task.id !== generation.sessionId))
const activeCount = computed(
  () => otherTasks.value.filter((task) => task.status === 'running').length + Number(generation.running),
)
const stopTask = async (id: string) => {
  if (stopping.value) return
  stopping.value = id
  try {
    await $fetch<unknown, '/api/articles/generations/:id/stop'>(
      `/api/articles/generations/${id}/stop` as '/api/articles/generations/:id/stop',
      { method: 'POST' },
    )
    await refresh({ dedupe: 'defer' })
  } catch {
    toast.add({ color: 'error', title: t('articles.editor.ai.stopFailed') })
  } finally {
    stopping.value = null
  }
}
const taskPath = (task: ArticleBackgroundTask) => ({
  path: localePath({ name: 'admin-editor-id', params: { id: task.slug ?? 'new' } }),
  query: task.language ? { lang: task.language } : {},
})
const { now, pause, resume } = useNow({
  controls: true,
  scheduler: (callback) => useIntervalFn(callback, 1_000, { immediate: false }),
})
// The editor that owns the run shows it itself.
const visible = computed(() => (!!generation.run && route.path !== generation.editorPath) || tasks.value.length > 0)
const running = computed(() => generation.running)
watch(
  () => visible.value && running.value,
  (active) => {
    if (!active) return pause()
    now.value = new Date()
    resume()
  },
  { immediate: true },
)
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
