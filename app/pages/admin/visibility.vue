<template>
  <UContainer>
    <DefinePromptForm>
      <form
        class="grid gap-3 text-left sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
        @submit.prevent="addPrompt"
      >
        <UFormField :label="$t('visibility.prompts.questionLabel')">
          <UInput v-model="newPrompt" required autofocus :placeholder="$t('visibility.prompts.placeholder')" />
        </UFormField>
        <UFormField :label="$t('visibility.prompts.languageLabel')">
          <USelect v-model="newLanguage" :items="languageItems" />
        </UFormField>
        <UButton type="submit" icon="mdi:plus" :loading="adding" :disabled="newPrompt.trim().length < 3">
          {{ $t('visibility.prompts.add') }}
        </UButton>
      </form>
    </DefinePromptForm>

    <DefineUpgrade>
      <div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p class="text-sm text-muted">{{ $t('visibility.upgrade.description') }}</p>
        <UButton :to="billingLink" icon="mdi:star-four-points" size="sm">{{ $t('visibility.upgrade.cta') }}</UButton>
      </div>
    </DefineUpgrade>

    <div class="space-y-6 py-8 sm:py-10">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="flex items-center gap-1">
            <h1 class="text-3xl font-bold tracking-tight text-highlighted">{{ $t('visibility.title') }}</h1>
            <UPopover :content="{ align: 'start' }">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="mdi:information-outline"
                :aria-label="$t('visibility.about')"
              />
              <template #content>
                <div class="max-w-sm space-y-1 p-4">
                  <p class="text-sm font-semibold text-highlighted">{{ $t('visibility.about') }}</p>
                  <p class="text-sm leading-6 text-muted">{{ $t('visibility.methodology') }}</p>
                </div>
              </template>
            </UPopover>
          </div>
          <p class="mt-1 text-muted">{{ $t('visibility.description') }}</p>
        </div>
        <p v-if="hasData" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="mdi:calendar-range" class="size-4" aria-hidden="true" />
          {{ $t('visibility.window', { days: data?.windowDays ?? 30 }) }}
        </p>
      </header>

      <div v-if="pending" class="grid gap-4 sm:grid-cols-3" aria-busy="true">
        <USkeleton v-for="item in 3" :key="item" class="h-28" />
      </div>

      <section
        v-else-if="data && !hasData"
        class="rounded-(--topiqu-surface-radius) border border-default bg-default px-6 py-12 text-center sm:px-10"
      >
        <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
          <UIcon name="mdi:radar" class="size-6 text-primary" aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-xl font-semibold text-highlighted">{{ $t('visibility.onboarding.title') }}</h2>
        <p class="mx-auto mt-2 max-w-xl leading-7 text-muted">{{ $t('visibility.onboarding.description') }}</p>
        <div v-if="canSample" class="mx-auto mt-6 max-w-2xl">
          <ReusePromptForm v-if="showForm" />
          <div v-else class="flex flex-col items-center gap-3">
            <p class="text-sm text-muted">{{ $t('visibility.onboarding.pending') }}</p>
            <UButton icon="mdi:plus" color="neutral" variant="outline" @click="showForm = true">
              {{ $t('visibility.prompts.add') }}
            </UButton>
          </div>
        </div>
        <div v-else class="mx-auto mt-6 max-w-xl">
          <ReuseUpgrade />
        </div>
        <p class="mx-auto mt-8 max-w-xl text-xs text-muted">{{ $t('visibility.onboarding.note') }}</p>
      </section>

      <template v-else-if="data">
        <dl
          class="grid overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default sm:grid-cols-3"
        >
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="min-w-0 border-b border-default p-5 last:border-0 sm:border-b-0 sm:border-r"
          >
            <dt class="text-sm text-muted">{{ metric.label }}</dt>
            <dd class="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-highlighted">
              {{ metric.value }}
            </dd>
            <dd class="mt-1 text-xs text-muted">{{ metric.note }}</dd>
          </div>
        </dl>

        <section class="rounded-(--topiqu-surface-radius) border border-default bg-default">
          <div class="flex flex-col gap-3 border-b border-default px-5 py-4 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.prompts.title') }}</h2>
              <p class="text-sm text-muted">{{ $t('visibility.prompts.description') }}</p>
            </div>
            <UButton v-if="!showForm" icon="mdi:plus" color="neutral" variant="soft" @click="showForm = true">
              {{ $t('visibility.prompts.add') }}
            </UButton>
          </div>

          <div v-if="showForm" class="border-b border-default bg-elevated/40 p-5">
            <ReusePromptForm />
          </div>
          <div v-if="!canSample" class="border-b border-default bg-primary/5 px-5 py-3">
            <ReuseUpgrade />
          </div>

          <ul v-if="data.prompts.length" class="divide-y divide-default">
            <li
              v-for="prompt in data.prompts"
              :key="prompt.id"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start"
            >
              <UCollapsible class="min-w-0 flex-1" :disabled="!prompt.latestRuns.length">
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  class="group/prompt w-full"
                  :ui="{ base: 'items-start justify-start' }"
                >
                  <span class="flex w-full items-start gap-3 text-left">
                    <span
                      class="mt-2 size-2.5 shrink-0 rounded-full"
                      :class="tones[outcomes[prompt.id]!.status]"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="flex flex-wrap items-center gap-2">
                        <span class="font-medium leading-6 text-highlighted">{{ prompt.text }}</span>
                        <UBadge color="neutral" variant="outline" size="sm">{{ prompt.language.toUpperCase() }}</UBadge>
                        <UBadge color="neutral" variant="soft" size="sm">
                          {{ $t(`visibility.prompts.sources.${prompt.source}`) }}
                        </UBadge>
                        <UBadge v-if="!prompt.active" color="warning" variant="subtle" size="sm" icon="mdi:pause">
                          {{ $t('visibility.prompts.paused') }}
                        </UBadge>
                      </span>
                      <span class="mt-0.5 flex items-center gap-1 text-sm text-muted">
                        {{ $t(`visibility.outcome.${outcomes[prompt.id]!.status}`, outcomes[prompt.id]!) }}
                        <UIcon
                          v-if="prompt.latestRuns.length"
                          name="mdi:chevron-down"
                          class="size-4 transition-transform group-data-[state=open]/prompt:rotate-180"
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </span>
                </UButton>

                <template #content>
                  <ul class="mt-3 divide-y divide-default rounded-(--topiqu-surface-radius) border border-default">
                    <li v-for="run in prompt.latestRuns" :key="run.id">
                      <UCollapsible>
                        <UButton
                          type="button"
                          color="neutral"
                          variant="ghost"
                          class="group/run w-full"
                          :ui="{ base: 'justify-start' }"
                        >
                          <span class="flex w-full items-center gap-3 text-left text-sm">
                            <span
                              class="size-2 shrink-0 rounded-full"
                              :class="tones[runOutcome(run)]"
                              aria-hidden="true"
                            />
                            <span class="min-w-0 flex-1 font-medium text-highlighted">
                              {{ $t(`visibility.providers.${run.provider}`) }}
                            </span>
                            <span class="text-muted">{{ $t(`visibility.runs.${runOutcome(run)}`) }}</span>
                            <NuxtTime :datetime="run.executedAt" relative class="hidden text-xs text-muted sm:inline" />
                            <UIcon
                              name="mdi:chevron-down"
                              class="size-4 shrink-0 text-muted transition-transform group-data-[state=open]/run:rotate-180"
                              aria-hidden="true"
                            />
                          </span>
                        </UButton>
                        <template #content>
                          <div class="space-y-4 border-t border-default bg-elevated/35 px-4 py-4">
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
                                    aria-hidden="true"
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
                    </li>
                  </ul>
                </template>
              </UCollapsible>

              <div class="flex shrink-0 items-center gap-1 pl-5.5 sm:pl-0">
                <UButton
                  v-if="canSample"
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="mdi:radar"
                  :loading="runningPrompt === prompt.id"
                  :disabled="!prompt.active"
                  @click="runPrompt(prompt.id)"
                >
                  {{ $t('visibility.prompts.run') }}
                </UButton>
                <UDropdownMenu :items="promptActions(prompt)" :content="{ align: 'end' }">
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="mdi:dots-horizontal"
                    :aria-label="$t('visibility.prompts.actions')"
                  />
                </UDropdownMenu>
              </div>
            </li>
          </ul>
          <p v-else class="px-5 py-10 text-center text-sm text-muted">
            {{ $t(canSample ? 'visibility.onboarding.pending' : 'visibility.onboarding.description') }}
          </p>
        </section>

        <section
          v-if="openOpportunities.length"
          class="rounded-(--topiqu-surface-radius) border border-default bg-default"
        >
          <div class="border-b border-default px-5 py-4">
            <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.opportunities.title') }}</h2>
            <p class="text-sm text-muted">{{ $t('visibility.opportunities.description') }}</p>
          </div>
          <ul class="divide-y divide-default">
            <li
              v-for="opportunity in openOpportunities"
              :key="opportunity.id"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
            >
              <div class="min-w-0 flex-1">
                <h3 class="font-medium leading-6 text-highlighted">{{ opportunity.prompt.text }}</h3>
                <p class="mt-0.5 text-xs text-muted">
                  {{
                    $t('visibility.opportunities.evidence', {
                      owned: opportunity.ownedHits,
                      external: opportunity.externalHits,
                      samples: opportunity.sampleSize,
                    })
                  }}
                </p>
                <p v-if="opportunity.citedDomains.length" class="mt-0.5 line-clamp-1 text-xs text-muted">
                  {{ $t('visibility.opportunities.domains', { domains: opportunity.citedDomains.join(', ') }) }}
                </p>
              </div>
              <div class="flex shrink-0 gap-2">
                <UButton
                  :to="opportunityLink(opportunity)"
                  size="sm"
                  :icon="opportunity.article ? 'mdi:file-edit-outline' : 'mdi:plus'"
                >
                  {{ $t(opportunity.article ? 'visibility.opportunities.update' : 'visibility.opportunities.create') }}
                </UButton>
                <UButton size="sm" color="neutral" variant="ghost" @click="setOpportunity(opportunity.id, 'DISMISSED')">
                  {{ $t('visibility.opportunities.dismiss') }}
                </UButton>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="hasDomains" class="rounded-(--topiqu-surface-radius) border border-default bg-default">
          <div class="border-b border-default px-5 py-4">
            <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.domains.title') }}</h2>
            <p class="text-sm text-muted">{{ $t('visibility.domains.description') }}</p>
          </div>
          <div class="grid divide-y divide-default lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <div v-for="group in domainGroups" :key="group.key" class="p-5">
              <h3 class="text-sm font-medium text-muted">{{ $t(`visibility.domains.${group.key}`) }}</h3>
              <p v-if="group.key === 'references'" class="mt-0.5 text-xs text-muted">
                {{ $t('visibility.domains.referencesHint') }}
              </p>
              <ul class="mt-2 divide-y divide-default">
                <li v-if="group.key === 'competitors'" class="py-2.5">
                  <div class="flex items-center justify-between gap-4 text-sm">
                    <span class="font-semibold text-highlighted">{{ $t('visibility.domains.you') }}</span>
                    <span class="font-semibold tabular-nums">{{ percent(ownShare) }}</span>
                  </div>
                  <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                    <div class="h-full rounded-full bg-success" :style="{ width: percent(ownShare) }" />
                  </div>
                </li>
                <li v-for="row in group.rows" :key="row.domain" class="py-2.5">
                  <div class="flex items-center gap-2 text-sm">
                    <span class="min-w-0 flex-1 truncate text-highlighted">{{ row.domain }}</span>
                    <UIcon
                      v-if="row.marked"
                      name="mdi:bookmark"
                      class="size-4 shrink-0 text-muted"
                      :aria-label="$t('visibility.domains.marked')"
                    />
                    <span class="tabular-nums">{{ percent(row.share) }}</span>
                    <UDropdownMenu :items="domainActions(row)" :content="{ align: 'end' }">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="mdi:dots-horizontal"
                        :aria-label="$t('visibility.domains.actions', { domain: row.domain })"
                      />
                    </UDropdownMenu>
                  </div>
                  <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                    <div class="h-full rounded-full bg-primary" :style="{ width: percent(row.share) }" />
                  </div>
                  <p class="mt-1 text-xs text-muted">{{ $t('visibility.domains.prompts', { count: row.prompts }) }}</p>
                </li>
              </ul>
            </div>
          </div>
          <div
            v-if="data.domains.hidden.length"
            class="flex flex-wrap items-center gap-2 border-t border-default px-5 py-3"
          >
            <span class="text-xs text-muted">{{ $t('visibility.domains.hidden') }}</span>
            <UButton
              v-for="domain in data.domains.hidden"
              :key="domain"
              size="xs"
              color="neutral"
              variant="soft"
              trailingIcon="mdi:eye-outline"
              :aria-label="$t('visibility.domains.restore', { domain })"
              @click="markDomain(domain, null)"
            >
              {{ domain }}
            </UButton>
          </div>
        </section>

        <section class="rounded-(--topiqu-surface-radius) border border-default bg-default">
          <h2 class="border-b border-default px-5 py-4 text-lg font-semibold text-highlighted">
            {{ $t('visibility.traffic.title') }}
          </h2>
          <div
            v-if="data.referrals.byChannel.length || data.crawlers.byBot.length"
            class="grid divide-y divide-default md:grid-cols-2 md:divide-x md:divide-y-0"
          >
            <div class="p-5">
              <h3 class="text-sm font-medium text-muted">{{ $t('visibility.traffic.referrals') }}</h3>
              <dl v-if="data.referrals.byChannel.length" class="mt-2 divide-y divide-default">
                <div
                  v-for="channel in data.referrals.byChannel"
                  :key="channel.channel"
                  class="flex items-center justify-between gap-4 py-2.5"
                >
                  <dt class="text-sm text-highlighted">{{ $t(`visibility.channels.${channel.channel}`) }}</dt>
                  <dd class="text-sm font-semibold tabular-nums">{{ number(channel.visits) }}</dd>
                </div>
              </dl>
              <p v-else class="mt-2 text-sm text-muted">{{ $t('visibility.traffic.none') }}</p>
            </div>
            <div class="p-5">
              <h3 class="text-sm font-medium text-muted">{{ $t('visibility.traffic.crawlers') }}</h3>
              <dl v-if="data.crawlers.byBot.length" class="mt-2 divide-y divide-default">
                <div
                  v-for="bot in data.crawlers.byBot"
                  :key="bot.bot"
                  class="flex items-center justify-between gap-4 py-2.5"
                >
                  <dt class="min-w-0">
                    <span class="block truncate text-sm text-highlighted">{{ bot.bot }}</span>
                    <span class="block text-xs text-muted">
                      {{ $t(`visibility.crawlers.kinds.${bot.kind}`) }} ·
                      <NuxtTime :datetime="bot.lastSeenAt" relative />
                    </span>
                  </dt>
                  <dd class="text-sm font-semibold tabular-nums">{{ number(bot.requests) }}</dd>
                </div>
              </dl>
              <p v-else class="mt-2 text-sm text-muted">{{ $t('visibility.traffic.none') }}</p>
            </div>
          </div>
          <p v-else class="px-5 py-8 text-center text-sm text-muted">{{ $t('visibility.traffic.empty') }}</p>
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
import type { DropdownMenuItem } from '@nuxt/ui'
import type { InternalApi } from 'nitropack/types'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { isLanguage, type Language } from '~~/shared/utils/language'
import { promptOutcome, runOutcome } from '~~/shared/utils/aiVisibility'

definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('visibility.title') })

type Overview = InternalApi['/api/ai-visibility/overview']['get']
type Opportunity = Overview['opportunities'][number]
type Prompt = Overview['prompts'][number]
type CitedDomain = Overview['domains']['competitors'][number]

const [DefinePromptForm, ReusePromptForm] = createReusableTemplate()
const [DefineUpgrade, ReuseUpgrade] = createReusableTemplate()

const { locale, t } = useI18n()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()
const apiFetch = $fetch as unknown as (url: string, options?: Record<string, unknown>) => Promise<any>
const toast = useToast()
const { data: clientStatus } = await useClientSiteStatus()
const numberFormat = computed(() => new Intl.NumberFormat(locale.value))
const percentFormat = computed(
  () => new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }),
)
const newPrompt = shallowRef('')
const newLanguage = shallowRef<Language>(isLanguage(locale.value) ? locale.value : 'en')
const showForm = shallowRef(false)
const adding = shallowRef(false)
const runningPrompt = shallowRef<string | null>(null)
const canSample = computed(() => ['PREMIUM', 'CUSTOM'].includes(clientStatus.value?.plan ?? ''))
const billingLink = computed(() => localePath({ name: 'settings', query: { tab: 'billing' } }))

const {
  data,
  isPending: pending,
  refetch,
} = useQuery({
  key: () => queryKeys.visibility.overview,
  query: () => requestFetch<Overview>('/api/ai-visibility/overview'),
})

const hasData = computed(
  () =>
    !!data.value &&
    (data.value.prompts.length > 0 || data.value.crawlers.requests > 0 || data.value.referrals.visits > 0),
)
const outcomes = computed(() =>
  Object.fromEntries((data.value?.prompts ?? []).map((prompt) => [prompt.id, promptOutcome(prompt.latestRuns)])),
)
const tones: Record<string, string> = {
  UNCHECKED: 'bg-accented',
  RUNNING: 'bg-info',
  FAILED: 'bg-error',
  CITED: 'bg-success',
  NOT_CITED: 'bg-warning',
}

const number = (value: number) => numberFormat.value.format(value)
const percent = (value: number) => percentFormat.value.format(value)
const metrics = computed(() => [
  {
    label: t('visibility.metrics.coverage'),
    value:
      data.value?.visibility.citationCoverage == null
        ? t('visibility.emptyValue')
        : percentFormat.value.format(data.value.visibility.citationCoverage),
    note: t('visibility.metrics.coverageNote', {
      owned: number(data.value?.visibility.ownedRuns ?? 0),
      total: number(data.value?.visibility.successfulRuns ?? 0),
    }),
  },
  {
    label: t('visibility.metrics.referrals'),
    value: number(data.value?.referrals.visits ?? 0),
    note: t('visibility.metrics.referralsNote', { count: number(data.value?.referrals.uniqueArticles ?? 0) }),
  },
  {
    label: t('visibility.metrics.fetches'),
    value: number(data.value?.crawlers.requests ?? 0),
    note: t('visibility.metrics.fetchesNote', { count: number(data.value?.crawlers.uniquePages ?? 0) }),
  },
])
const languageItems = computed(() =>
  LANGUAGE_OPTIONS.map((language) => ({
    label: t(`languages.${language}`),
    value: language,
  })),
)
const openOpportunities = computed(() => data.value?.opportunities.filter((item) => item.status === 'OPEN') ?? [])
const domainGroups = computed(() =>
  (['competitors', 'references', 'others'] as const)
    .map((key) => ({ key, rows: data.value?.domains[key] ?? [] }))
    .filter((group) => group.rows.length),
)
const hasDomains = computed(() => domainGroups.value.length > 0 || !!data.value?.domains.hidden.length)
const ownShare = computed(() => data.value?.visibility.citationCoverage ?? 0)

const mutate = async (work: () => Promise<unknown>, success?: string) => {
  try {
    const result = await work()
    await refetch()
    if (success) toast.add({ color: 'success', title: success })
    return result
  } catch (error: any) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('visibility.messages.failed')) })
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
  if (result) {
    newPrompt.value = ''
    showForm.value = false
  }
  adding.value = false
}

const runPrompt = async (id: string) => {
  runningPrompt.value = id
  await mutate(
    () => apiFetch(`/api/ai-visibility/prompts/${id}/run`, { method: 'POST' }),
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
const promptActions = (prompt: Prompt): DropdownMenuItem[][] => [
  [
    {
      label: t(prompt.active ? 'visibility.prompts.pause' : 'visibility.prompts.resume'),
      icon: prompt.active ? 'mdi:pause' : 'mdi:play',
      onSelect: () => togglePrompt(prompt.id, !prompt.active),
    },
  ],
  // A removed generated question would only be generated again; pausing is what retires it.
  ...(prompt.source === 'MANUAL'
    ? [
        [
          {
            label: t('visibility.prompts.remove'),
            icon: 'mdi:delete-outline',
            color: 'error' as const,
            onSelect: () => removePrompt(prompt.id),
          },
        ],
      ]
    : []),
]
const markDomain = (domain: string, mark: 'COMPETITOR' | 'HIDDEN' | null) =>
  mutate(() => apiFetch('/api/ai-visibility/domains', { method: 'PUT', body: { domain, mark } }))
const domainActions = (row: CitedDomain): DropdownMenuItem[][] => [
  [
    ...(row.marked
      ? [
          {
            label: t('visibility.domains.unmark'),
            icon: 'mdi:bookmark-remove-outline',
            onSelect: () => markDomain(row.domain, null),
          },
        ]
      : row.kind === 'COMPETITOR'
        ? []
        : [
            {
              label: t('visibility.domains.markCompetitor'),
              icon: 'mdi:bookmark-outline',
              onSelect: () => markDomain(row.domain, 'COMPETITOR'),
            },
          ]),
    {
      label: t('visibility.domains.hide'),
      icon: 'mdi:eye-off-outline',
      onSelect: () => markDomain(row.domain, 'HIDDEN'),
    },
  ],
]
const setOpportunity = (id: string, status: 'DISMISSED' | 'RESOLVED' | 'OPEN') =>
  mutate(() => apiFetch(`/api/ai-visibility/opportunities/${id}`, { method: 'PATCH', body: { status } }))
const opportunityLink = (opportunity: Opportunity) => ({
  path: localePath({ name: 'admin-editor-id', params: { id: opportunity.article?.slug ?? 'new' } }),
  query: { ai: '1', prompt: opportunity.prompt.text },
})
</script>
