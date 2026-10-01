<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { isLanguage, type Language } from '~~/shared/utils/language'

import type {
  VisibilityOverview as Overview,
  VisibilityPrompt as Prompt,
  VisibilityDomain as CitedDomain,
} from '~/types/visibility'

type Opportunity = Overview['opportunities'][number]

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

const number = (value: number) => numberFormat.value.format(value)
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

    <div class="space-y-5 py-6 sm:py-8">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="flex items-center gap-1">
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ $t('visibility.title') }}</h1>
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
        <dl class="grid grid-cols-3 overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default">
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="min-w-0 border-r border-default px-3 py-3 last:border-0 sm:px-4"
          >
            <dt class="min-h-8 text-xs leading-4 text-muted sm:min-h-0 sm:text-sm">{{ metric.label }}</dt>
            <dd class="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-highlighted">
              {{ metric.value }}
            </dd>
            <dd class="mt-1 text-xs text-muted">{{ metric.note }}</dd>
          </div>
        </dl>

        <section class="rounded-(--topiqu-surface-radius) border border-default bg-default">
          <div class="flex flex-col gap-3 border-b border-default px-5 py-4 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <h2 class="text-lg font-semibold text-highlighted">{{ $t('visibility.prompts.title') }}</h2>
              <UPopover :content="{ align: 'start' }"
                ><UButton size="xs" color="neutral" variant="link" icon="mdi:information-outline">{{
                  $t('visibility.prompts.schedule')
                }}</UButton
                ><template #content
                  ><p class="max-w-sm p-4 text-sm leading-6 text-muted">
                    {{ $t('visibility.prompts.description') }}
                  </p></template
                ></UPopover
              >
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
            <li v-for="prompt in data.prompts" :key="prompt.id" class="px-4 py-2.5">
              <StatsVisibilityPromptRow
                :prompt="prompt"
                :canSample="canSample"
                :running="runningPrompt === prompt.id"
                :disabled="runningPrompt !== null"
                :actions="promptActions(prompt)"
                @run="runPrompt(prompt.id)"
              />
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

        <StatsVisibilitySources
          :groups="domainGroups"
          :hidden="data.domains.hidden"
          :ownShare="ownShare"
          :actions="domainActions"
          @restore="markDomain($event, null)"
        />
        <StatsVisibilityTraffic :referrals="data.referrals" :crawlers="data.crawlers" />
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
