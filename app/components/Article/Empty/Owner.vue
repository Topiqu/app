<template>
  <div class="flex w-full flex-col items-center gap-8">
    <p
      class="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <Icon name="mdi:eye-off-outline" class="h-4 w-4" aria-hidden="true" />
      {{ $t('articles.empty.owner.badge') }}
    </p>

    <div class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {{ site?.name }}
      </p>
      <h1 class="text-balance text-4xl font-black tracking-tight text-gray-900 sm:text-5xl dark:text-gray-100">
        {{ $t('articles.empty.owner.title') }}
      </h1>
      <p class="mx-auto max-w-xl text-balance text-lg leading-relaxed text-gray-600 dark:text-gray-300">
        {{ $t('articles.empty.owner.message') }}
      </p>
    </div>

    <div class="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
      <NuxtLink
        :to="localePath({ name: 'admin-editor-id', params: { id: 'new' } })"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white no-underline shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
      >
        <Icon name="mdi:pencil-plus-outline" class="h-5 w-5" aria-hidden="true" />
        {{ $t('articles.empty.owner.writeCta') }}
      </NuxtLink>
      <NuxtLink
        :to="localePath({ name: 'admin-editor-id', params: { id: 'new' }, query: { ai: '1' } })"
        class="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-6 py-3 font-semibold text-purple-700 no-underline transition hover:bg-purple-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 dark:border-purple-500/40 dark:bg-gray-900 dark:text-purple-300 dark:hover:bg-purple-500/10"
      >
        <Icon name="mdi:sparkles" class="h-5 w-5" aria-hidden="true" />
        {{ $t('articles.empty.owner.aiCta') }}
      </NuxtLink>
    </div>

    <section
      class="w-full rounded-3xl border border-gray-200 bg-white/80 p-5 text-left shadow-sm backdrop-blur sm:p-6 dark:border-gray-800 dark:bg-gray-900/70"
    >
      <header class="flex items-center justify-between gap-4">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {{ $t('articles.empty.owner.checklistTitle') }}
        </h2>
        <span class="text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-400">
          {{ $t('articles.empty.owner.progress', progress) }}
        </span>
      </header>

      <div
        class="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        :aria-valuenow="progress.done"
        :aria-valuemin="0"
        :aria-valuemax="progress.total"
        :aria-label="$t('articles.empty.owner.checklistTitle')"
      >
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-500"
          :style="{ width: `${progress.percent}%` }"
        />
      </div>

      <ul class="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
        <li v-for="step in rows" :key="step.id">
          <NuxtLink v-if="!step.locked" :to="step.to" :class="[rowClass, 'hover:bg-gray-50 dark:hover:bg-gray-800/60']">
            <Icon
              :name="step.done ? 'mdi:check-circle' : step.icon"
              :class="['h-6 w-6 shrink-0', step.done ? 'text-green-500' : 'text-blue-500']"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span
                :class="[
                  'block font-semibold',
                  step.done
                    ? 'text-gray-400 line-through decoration-1 dark:text-gray-500'
                    : 'text-gray-800 dark:text-gray-100',
                ]"
              >
                {{ $t(`articles.empty.owner.steps.${step.id}.title`) }}
              </span>
              <span class="block text-sm text-gray-500 dark:text-gray-400">
                {{ $t(`articles.empty.owner.steps.${step.id}.description`) }}
              </span>
            </span>
            <Icon
              name="mdi:chevron-right"
              class="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600"
              aria-hidden="true"
            />
          </NuxtLink>

          <div v-else :class="[rowClass, 'opacity-70']">
            <Icon name="mdi:lock-outline" class="h-6 w-6 shrink-0 text-gray-400" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block font-semibold text-gray-500 dark:text-gray-400">
                {{ $t(`articles.empty.owner.steps.${step.id}.title`) }}
              </span>
              <span class="block text-sm text-gray-400 dark:text-gray-500">
                {{ $t('articles.empty.owner.locked') }}
              </span>
            </span>
          </div>
        </li>
      </ul>
    </section>

    <NuxtLink
      :to="localePath({ name: 'admin' })"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 no-underline transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
    >
      {{ $t('articles.empty.owner.adminCta') }}
      <Icon name="mdi:arrow-right" class="h-4 w-4" aria-hidden="true" />
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { EmptySetupStepId, EmptySiteInfo } from '~~/shared/utils/emptySite'

import { buildEmptySetupSteps, emptySetupProgress } from '~~/shared/utils/emptySite'

const { site } = defineProps<{ site?: EmptySiteInfo | null }>()

const localePath = useLocalePath()
const { data: status } = await useClientSiteStatus()

const rowClass =
  'flex items-center gap-4 rounded-2xl px-2 py-3.5 no-underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50'

const stepMeta: Record<EmptySetupStepId, { icon: string; to: () => RouteLocationRaw }> = {
  article: {
    icon: 'mdi:file-document-edit-outline',
    to: () => localePath({ name: 'admin-editor-id', params: { id: 'new' } }),
  },
  branding: {
    icon: 'mdi:palette-outline',
    to: () => localePath({ name: 'settings', query: { tab: 'branding' } }),
  },
  voice: {
    icon: 'mdi:robot-outline',
    to: () => localePath({ name: 'settings', query: { tab: 'content' } }),
  },
  domain: {
    icon: 'mdi:web-check',
    to: () => localePath({ name: 'admin' }),
  },
}

const steps = computed(() =>
  buildEmptySetupSteps({ ...site, focus: status.value?.focus, audience: status.value?.audience }),
)
const progress = computed(() => emptySetupProgress(steps.value))
const rows = computed(() => steps.value.map((step) => ({ ...step, ...stepMeta[step.id], to: stepMeta[step.id].to() })))
</script>
