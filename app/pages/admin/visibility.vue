<template>
  <UContainer>
    <div class="space-y-8 py-8 sm:py-10">
      <header class="flex flex-col gap-5 border-b border-default pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{{ $t('visibility.eyebrow') }}</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
            {{ $t('visibility.title') }}
          </h1>
          <p class="mt-3 max-w-2xl text-base leading-7 text-muted">{{ $t('visibility.description') }}</p>
        </div>
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="mdi:calendar-range" class="size-4" aria-hidden="true" />
          {{ $t('visibility.window', { days: data?.windowDays ?? 30 }) }}
        </div>
      </header>

      <UAlert
        color="warning"
        variant="subtle"
        icon="mdi:information-outline"
        :description="$t('visibility.methodology')"
      />

      <div v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        <USkeleton v-for="item in 4" :key="item" class="h-28" />
      </div>
      <template v-else-if="data">
        <section
          class="grid overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default sm:grid-cols-2 xl:grid-cols-4"
        >
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="min-w-0 border-b border-default p-5 last:border-b-0 sm:nth-[2n+1]:border-r sm:nth-last-[-n+2]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm text-muted">{{ metric.label }}</p>
              <UIcon :name="metric.icon" class="size-5 text-primary" aria-hidden="true" />
            </div>
            <p class="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-highlighted">{{ metric.value }}</p>
            <p class="mt-1 text-xs text-muted">{{ metric.note }}</p>
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
          <section class="min-w-0 rounded-(--topiqu-surface-radius) border border-default bg-default">
            <div class="border-b border-default px-5 py-4">
              <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.crawlers.title') }}</h2>
              <p class="mt-1 text-sm leading-6 text-muted">{{ $t('visibility.crawlers.description') }}</p>
            </div>
            <div v-if="data.crawlers.byBot.length" class="overflow-x-auto">
              <div class="min-w-[36rem]">
                <UTable :data="data.crawlers.byBot" :columns="crawlerColumns">
                  <template #bot-cell="{ row }">
                    <span class="font-medium text-highlighted">{{ row.original.bot }}</span>
                  </template>
                  <template #kind-cell="{ row }">
                    <UBadge color="neutral" variant="subtle">
                      {{ $t(`visibility.crawlers.kinds.${row.original.kind}`) }}
                    </UBadge>
                  </template>
                  <template #requests-cell="{ row }">
                    <span class="block text-right tabular-nums">{{ number(row.original.requests) }}</span>
                  </template>
                  <template #pages-cell="{ row }">
                    <span class="block text-right tabular-nums">{{ number(row.original.pages) }}</span>
                  </template>
                  <template #lastSeenAt-cell="{ row }">
                    <span class="block text-right text-muted">
                      <NuxtTime :datetime="row.original.lastSeenAt" relative />
                    </span>
                  </template>
                </UTable>
              </div>
            </div>
            <p v-else class="px-5 py-10 text-center text-sm text-muted">{{ $t('visibility.crawlers.empty') }}</p>
          </section>

          <section class="rounded-(--topiqu-surface-radius) border border-default bg-default p-5">
            <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.referrals.title') }}</h2>
            <p class="mt-1 text-sm leading-6 text-muted">{{ $t('visibility.referrals.description') }}</p>
            <dl v-if="data.referrals.byChannel.length" class="mt-5 divide-y divide-default">
              <div
                v-for="channel in data.referrals.byChannel"
                :key="channel.channel"
                class="flex items-center justify-between gap-4 py-3"
              >
                <dt class="text-sm text-highlighted">{{ $t(`visibility.channels.${channel.channel}`) }}</dt>
                <dd class="font-semibold tabular-nums">{{ number(channel.visits) }}</dd>
              </div>
            </dl>
            <p v-else class="py-10 text-center text-sm text-muted">{{ $t('visibility.referrals.empty') }}</p>
          </section>
        </div>

        <section class="rounded-(--topiqu-surface-radius) border border-default bg-default">
          <div
            class="flex flex-col gap-4 border-b border-default px-5 py-5 lg:flex-row lg:items-end lg:justify-between"
          >
            <div class="max-w-2xl">
              <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.prompts.title') }}</h2>
              <p class="mt-1 text-sm leading-6 text-muted">{{ $t('visibility.prompts.description') }}</p>
            </div>
            <UButton
              icon="mdi:lightbulb-outline"
              color="neutral"
              variant="soft"
              :loading="suggesting"
              @click="suggestPrompts"
            >
              {{ $t('visibility.prompts.suggest') }}
            </UButton>
          </div>

          <form
            class="grid gap-3 border-b border-default bg-elevated/40 p-5 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
            @submit.prevent="addPrompt"
          >
            <UFormField :label="$t('visibility.prompts.questionLabel')">
              <UInput v-model="newPrompt" required :placeholder="$t('visibility.prompts.placeholder')" />
            </UFormField>
            <UFormField :label="$t('visibility.prompts.languageLabel')">
              <USelect v-model="newLanguage" :items="languageItems" />
            </UFormField>
            <UButton type="submit" icon="mdi:plus" :loading="adding" :disabled="newPrompt.trim().length < 3">
              {{ $t('visibility.prompts.add') }}
            </UButton>
          </form>

          <p v-if="!canSample" class="border-b border-default px-5 py-3 text-sm text-warning">
            {{ $t('visibility.prompts.premium') }}
          </p>

          <div v-if="data.prompts.length" class="divide-y divide-default">
            <div
              v-for="prompt in data.prompts"
              :key="prompt.id"
              class="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center"
            >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-medium leading-6 text-highlighted">{{ prompt.text }}</p>
                  <UBadge color="neutral" variant="outline">{{ prompt.language.toUpperCase() }}</UBadge>
                  <UBadge v-if="!prompt.active" color="warning" variant="subtle" icon="mdi:pause">{{
                    $t('visibility.prompts.paused')
                  }}</UBadge>
                </div>
                <p class="mt-1 text-xs text-muted">{{ plural('visibility.prompts.runs', prompt._count.runs) }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  size="sm"
                  icon="mdi:radar"
                  :loading="runningPrompt === prompt.id"
                  :disabled="!prompt.active || !canSample"
                  @click="runPrompt(prompt.id)"
                >
                  {{ $t('visibility.prompts.run') }}
                </UButton>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  :icon="prompt.active ? 'mdi:pause' : 'mdi:play'"
                  @click="togglePrompt(prompt.id, !prompt.active)"
                >
                  {{ $t(prompt.active ? 'visibility.prompts.pause' : 'visibility.prompts.resume') }}
                </UButton>
                <UButton
                  size="sm"
                  color="error"
                  variant="ghost"
                  icon="mdi:delete-outline"
                  :aria-label="$t('visibility.prompts.remove')"
                  @click="removePrompt(prompt.id)"
                />
              </div>
            </div>
          </div>
          <p v-else class="px-5 py-12 text-center text-sm text-muted">{{ $t('visibility.prompts.empty') }}</p>
        </section>

        <section class="grid gap-6 xl:grid-cols-2">
          <div class="rounded-(--topiqu-surface-radius) border border-default bg-default">
            <div class="border-b border-default px-5 py-4">
              <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.runs.title') }}</h2>
            </div>
            <div v-if="data.visibility.recentRuns.length" class="divide-y divide-default">
              <UCollapsible v-for="run in data.visibility.recentRuns.slice(0, 10)" :key="run.id">
                <UButton type="button" color="neutral" variant="ghost" class="w-full text-left">
                  <span
                    class="mt-1 size-2.5 shrink-0 rounded-full"
                    :class="
                      run.status === 'FAILED'
                        ? 'bg-error'
                        : run.status === 'RUNNING'
                          ? 'bg-info'
                          : run.citations.some((citation) => citation.owned)
                            ? 'bg-success'
                            : 'bg-warning'
                    "
                  />
                  <span class="min-w-0 flex-1">
                    <span class="line-clamp-2 text-sm font-medium text-highlighted">{{ run.prompt.text }}</span>
                    <span class="mt-1 block text-xs text-muted">
                      {{ runOutcome(run) }} · <NuxtTime :datetime="run.executedAt" relative /> ·
                      {{ $t('visibility.runs.sampled', { provider: $t(`visibility.providers.${run.provider}`) }) }}
                    </span>
                  </span>
                  <UIcon name="mdi:chevron-down" class="mt-1 size-4 shrink-0 text-muted" />
                </UButton>
                <template #content>
                  <div class="space-y-4 border-t border-default bg-elevated/35 px-5 py-4">
                    <p v-if="run.error" class="text-sm text-error">{{ run.error }}</p>
                    <div v-else-if="run.responseText">
                      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        {{ $t('visibility.runs.response') }}
                      </p>
                      <StatsAnswerMarkdown :text="run.responseText" class="max-h-96 overflow-y-auto pr-2" />
                    </div>
                    <div v-if="run.citations.length">
                      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        {{ $t('visibility.runs.citations') }}
                      </p>
                      <ul class="space-y-2">
                        <li
                          v-for="citation in run.citations"
                          :key="citation.normalizedUrl"
                          class="flex items-start gap-2 text-sm"
                        >
                          <UIcon
                            :name="citation.owned ? 'mdi:check-circle' : 'mdi:link-variant'"
                            :class="citation.owned ? 'text-success' : 'text-muted'"
                            class="mt-0.5 size-4 shrink-0"
                          />
                          <a
                            :href="citation.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="min-w-0 truncate text-primary hover:underline"
                          >
                            {{ citation.title || citation.domain }}
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>
              </UCollapsible>
            </div>
            <p v-else class="px-5 py-12 text-center text-sm text-muted">{{ $t('visibility.runs.empty') }}</p>
          </div>

          <div class="rounded-(--topiqu-surface-radius) border border-default bg-default">
            <div class="border-b border-default px-5 py-4">
              <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.opportunities.title') }}</h2>
              <p class="mt-1 text-sm leading-6 text-muted">{{ $t('visibility.opportunities.description') }}</p>
            </div>
            <div v-if="openOpportunities.length" class="divide-y divide-default">
              <article v-for="opportunity in openOpportunities" :key="opportunity.id" class="space-y-3 px-5 py-5">
                <div>
                  <h3 class="font-medium leading-6 text-highlighted">{{ opportunity.prompt.text }}</h3>
                  <p class="mt-1 text-xs text-muted">
                    {{
                      $t('visibility.opportunities.evidence', {
                        owned: opportunity.ownedHits,
                        external: opportunity.externalHits,
                        samples: opportunity.sampleSize,
                      })
                    }}
                  </p>
                  <p v-if="opportunity.citedDomains.length" class="mt-1 line-clamp-2 text-xs text-muted">
                    {{ $t('visibility.opportunities.domains', { domains: opportunity.citedDomains.join(', ') }) }}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    :to="opportunityLink(opportunity)"
                    size="sm"
                    :icon="opportunity.article ? 'mdi:file-edit-outline' : 'mdi:plus'"
                  >
                    {{
                      $t(opportunity.article ? 'visibility.opportunities.update' : 'visibility.opportunities.create')
                    }}
                  </UButton>
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    @click="setOpportunity(opportunity.id, 'DISMISSED')"
                  >
                    {{ $t('visibility.opportunities.dismiss') }}
                  </UButton>
                </div>
              </article>
            </div>
            <p v-else class="px-5 py-12 text-center text-sm text-muted">{{ $t('visibility.opportunities.empty') }}</p>
          </div>
        </section>
      </template>

      <UAlert
        v-else
        color="error"
        variant="subtle"
        icon="mdi:alert-circle-outline"
        :description="$t('visibility.messages.failed')"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InternalApi } from 'nitropack/types'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('visibility.title') })

type Overview = InternalApi['/api/ai-visibility/overview']['get']
type Opportunity = Overview['opportunities'][number]
type CrawlerRow = Overview['crawlers']['byBot'][number]
type Run = Overview['visibility']['recentRuns'][number]

const { locale, t } = useI18n()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()
const apiFetch = $fetch as unknown as (url: string, options?: Record<string, unknown>) => Promise<any>
const toast = useAppToast()
const { data: clientStatus } = await useClientSiteStatus()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const percentFormat = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }),
)
const newPrompt = shallowRef('')
const newLanguage = shallowRef<'cs' | 'en'>(locale.value === 'cs' ? 'cs' : 'en')
const adding = shallowRef(false)
const suggesting = shallowRef(false)
const runningPrompt = shallowRef<string | null>(null)
const canSample = computed(() => ['PREMIUM', 'CUSTOM'].includes(clientStatus.value?.plan ?? ''))

const {
  data,
  isPending: pending,
  refetch,
} = useQuery({
  key: () => queryKeys.visibility.overview,
  query: () => requestFetch<Overview>('/api/ai-visibility/overview'),
})

const number = (value: number) => numberFormat.value.format(value)
const plural = (key: string, count: number) => t(key, { count: number(count) }, { plural: count })
const runOutcome = (run: Run) => {
  if (run.status !== 'SUCCEEDED') return t(`visibility.status.${run.status}`)
  return t(run.citations.some((citation) => citation.owned) ? 'visibility.runs.cited' : 'visibility.runs.notCited')
}
const metrics = computed(() => [
  {
    label: t('visibility.metrics.fetches'),
    value: number(data.value?.crawlers.requests ?? 0),
    note: t('visibility.window', { days: data.value?.windowDays ?? 30 }),
    icon: 'mdi:robot-outline',
  },
  {
    label: t('visibility.metrics.pages'),
    value: number(data.value?.crawlers.uniquePages ?? 0),
    note: `${number(data.value?.crawlers.rateLimited ?? 0)} HTTP 429`,
    icon: 'mdi:file-search-outline',
  },
  {
    label: t('visibility.metrics.referrals'),
    value: number(data.value?.referrals.visits ?? 0),
    note: `${number(data.value?.referrals.uniqueArticles ?? 0)} ${t('articles.title').toLocaleLowerCase()}`,
    icon: 'mdi:arrow-left-bottom',
  },
  {
    label: t('visibility.metrics.coverage'),
    value:
      data.value?.visibility.citationCoverage == null
        ? t('visibility.emptyValue')
        : percentFormat.value.format(data.value.visibility.citationCoverage),
    note: `${number(data.value?.visibility.ownedRuns ?? 0)} / ${number(data.value?.visibility.successfulRuns ?? 0)}`,
    icon: 'mdi:format-quote-close',
  },
])
const languageItems = computed(() => [
  { label: t('languages.cs'), value: 'cs' },
  { label: t('languages.en'), value: 'en' },
])
const crawlerColumns = computed<TableColumn<CrawlerRow>[]>(() => [
  { accessorKey: 'bot', header: t('visibility.crawlers.bot') },
  { accessorKey: 'kind', header: t('visibility.crawlers.kind') },
  { accessorKey: 'requests', header: t('visibility.crawlers.requests') },
  { accessorKey: 'pages', header: t('visibility.crawlers.pages') },
  { accessorKey: 'lastSeenAt', header: t('visibility.crawlers.lastSeen') },
])
const openOpportunities = computed(() => data.value?.opportunities.filter((item) => item.status === 'OPEN') ?? [])

const mutate = async (work: () => Promise<unknown>, success?: string) => {
  try {
    const result = await work()
    await refetch()
    if (success) toast.success({ message: success })
    return result
  } catch (error: any) {
    toast.error({ message: error?.data?.message || t('visibility.messages.failed') })
    return null
  }
}

const addPrompt = async () => {
  if (newPrompt.value.trim().length < 3) return
  adding.value = true
  const result = await mutate(
    () =>
      apiFetch('/api/ai-visibility/prompts', {
        method: 'POST',
        body: { text: newPrompt.value, language: newLanguage.value },
      }),
    t('visibility.prompts.created'),
  )
  if (result) newPrompt.value = ''
  adding.value = false
}

const suggestPrompts = async () => {
  suggesting.value = true
  const result = (await mutate(() => apiFetch('/api/ai-visibility/prompts/suggest', { method: 'POST' }))) as {
    created: number
  } | null
  if (result) toast.success({ message: t('visibility.prompts.suggested', { count: result.created }) })
  suggesting.value = false
}

const runPrompt = async (id: string) => {
  runningPrompt.value = id
  await mutate(
    () =>
      apiFetch(`/api/ai-visibility/prompts/${id}/run`, {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
    t('visibility.messages.runStarted'),
  )
  runningPrompt.value = null
}

const togglePrompt = (id: string, active: boolean) =>
  mutate(
    () => apiFetch(`/api/ai-visibility/prompts/${id}`, { method: 'PATCH', body: { active } }),
    t('visibility.messages.saved'),
  )
const removePrompt = (id: string) => mutate(() => apiFetch(`/api/ai-visibility/prompts/${id}`, { method: 'DELETE' }))
const setOpportunity = (id: string, status: 'DISMISSED' | 'RESOLVED' | 'OPEN') =>
  mutate(() => apiFetch(`/api/ai-visibility/opportunities/${id}`, { method: 'PATCH', body: { status } }))
const opportunityLink = (opportunity: Opportunity) => ({
  path: localePath({ name: 'admin-editor-id', params: { id: opportunity.article?.slug ?? 'new' } }),
  query: { ai: '1', prompt: opportunity.prompt.text },
})
</script>
