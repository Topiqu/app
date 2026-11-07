<template>
  <ol
    :aria-label="$t('common.websiteImport.progress.label')"
    aria-live="polite"
    class="flex flex-col rounded-md border border-default/70 p-2"
    data-website-import-progress
  >
    <li
      v-for="item in steps"
      :key="item.id"
      class="grid grid-cols-[1.75rem_1fr] gap-2 rounded-md px-2 py-2"
      :class="item.state === 'running' ? 'bg-elevated' : ''"
      :aria-current="item.state === 'running' ? 'step' : undefined"
      :data-step="item.id"
      :data-state="item.state"
    >
      <span class="grid size-7 place-items-center rounded-full border" :class="tone[item.state].class">
        <UIcon
          :name="tone[item.state].icon"
          size="15"
          :class="item.state === 'running' ? 'animate-spin motion-reduce:animate-none' : ''"
          aria-hidden="true"
        />
        <span class="sr-only">{{ $t(`common.websiteImport.progress.state.${item.state}`) }}</span>
      </span>
      <div class="min-w-0">
        <p class="text-sm font-medium" :class="item.state === 'pending' ? 'text-muted' : 'text-highlighted'">
          {{ $t(`common.websiteImport.steps.${item.id}`) }}
          <span v-if="item.state === 'running'" class="ml-1 text-xs font-normal text-muted tabular-nums">
            {{ $t('common.websiteImport.progress.elapsed', { seconds: elapsed(item.at) }) }}
          </span>
        </p>
        <p v-if="item.detail" class="mt-0.5 text-xs leading-5" :class="tone[item.state].text">{{ item.detail }}</p>
        <ul v-if="item.id === 'pages' && pages.length" class="mt-1.5 space-y-1">
          <li
            v-for="page in pages"
            :key="page.url"
            class="flex min-w-0 items-center gap-1.5 text-xs"
            :class="page.state === 'failed' ? 'text-warning' : 'text-muted'"
          >
            <UIcon :name="page.state === 'failed' ? 'mdi:close' : 'mdi:check'" size="14" aria-hidden="true" />
            <span class="truncate">{{ page.label }}</span>
            <span class="sr-only">{{ $t(`common.websiteImport.progress.page.${page.state}`) }}</span>
          </li>
        </ul>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import type { WebsiteImportStep, WebsiteImportStepState, WebsiteImportView } from '~~/shared/utils/websiteImport'

type State = WebsiteImportStepState | 'pending' | 'skipped'

const { job } = defineProps<{ job: Pick<WebsiteImportView, 'status' | 'progress'> }>()
const { t } = useI18n()
const { now, pause, resume } = useNow({
  controls: true,
  scheduler: (callback) => useIntervalFn(callback, 1_000, { immediate: false }),
})

const detail = (id: WebsiteImportStep, state: State, step?: { count?: number; code?: string }) => {
  if (state === 'failed') return t('common.websiteImport.progress.failedHere')
  if (state === 'warning' && step?.code) return t(`common.websiteImport.warnings.${step.code}`)
  if (id === 'search' && state === 'done') return t('common.websiteImport.progress.found', { count: step?.count ?? 0 })
  return null
}
const elapsed = (at?: string) => Math.max(0, Math.floor((now.value.getTime() - Date.parse(at ?? '')) / 1000) || 0)

const steps = computed(() =>
  WEBSITE_IMPORT_STEPS.map((id) => {
    const step = job.progress?.steps[id]
    // A step still marked running on a failed import is where an abandoned worker stopped.
    const state: State = !step
      ? job.status === 'FAILED'
        ? 'skipped'
        : 'pending'
      : step.state === 'running' && job.status === 'FAILED'
        ? 'failed'
        : step.state
    return { id, state, at: step?.at, detail: detail(id, state, step) }
  }),
)
const running = computed(() => steps.value.some((step) => step.state === 'running'))
watch(running, (active) => (active ? resume() : pause()), { immediate: true })

const pages = computed(() =>
  (job.progress?.pages ?? []).map(({ url, state }) => {
    const target = new URL(url)
    let path = target.pathname
    try {
      path = decodeURIComponent(path)
    } catch {
      // Keep the encoded form of a malformed path.
    }
    return { url, state, label: `${target.hostname.replace(/^www\./, '')}${path === '/' ? '' : path}` }
  }),
)

const tone: Record<State, { icon: string; class: string; text: string }> = {
  pending: { icon: 'mdi:circle-small', class: 'border-default text-muted', text: 'text-muted' },
  running: { icon: 'mdi:loading', class: 'border-primary/30 bg-primary/10 text-primary', text: 'text-muted' },
  done: { icon: 'mdi:check', class: 'border-success/30 bg-success/10 text-success', text: 'text-muted' },
  warning: { icon: 'mdi:alert-outline', class: 'border-warning/30 bg-warning/10 text-warning', text: 'text-warning' },
  waiting: { icon: 'mdi:timer-sand', class: 'border-warning/30 bg-warning/10 text-warning', text: 'text-muted' },
  failed: { icon: 'mdi:close', class: 'border-error/30 bg-error/10 text-error', text: 'text-error' },
  skipped: { icon: 'mdi:minus', class: 'border-default text-muted', text: 'text-muted' },
}
</script>
