<template>
  <div class="flex w-full flex-col items-center gap-8">
    <UBadge color="warning" variant="soft" icon="i-mdi-eye-off-outline">
      {{ $t('articles.empty.owner.badge') }}
    </UBadge>

    <div class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {{ site?.name }}
      </p>
      <h1 class="text-balance text-4xl font-black tracking-tight text-highlighted sm:text-5xl">
        {{ $t('articles.empty.owner.title') }}
      </h1>
      <p class="mx-auto max-w-xl text-balance text-lg leading-relaxed text-muted">
        {{ $t('articles.empty.owner.message') }}
      </p>
    </div>

    <div class="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
      <UButton
        :to="localePath({ name: 'admin-editor-id', params: { id: 'new' } })"
        icon="i-mdi-pencil-plus-outline"
        size="lg"
      >
        {{ $t('articles.empty.owner.writeCta') }}
      </UButton>
      <UButton
        :to="localePath({ name: 'admin-editor-id', params: { id: 'new' }, query: { ai: '1' } })"
        color="neutral"
        variant="outline"
        icon="i-mdi-sparkles"
        size="lg"
      >
        {{ $t('articles.empty.owner.aiCta') }}
      </UButton>
    </div>

    <UCard class="w-full text-left">
      <header class="flex items-center justify-between gap-4">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-muted">
          {{ $t('articles.empty.owner.checklistTitle') }}
        </h2>
        <span class="text-xs font-semibold tabular-nums text-muted">
          {{ $t('articles.empty.owner.progress', progress) }}
        </span>
      </header>

      <UProgress class="mt-4" :modelValue="progress.percent" :aria-label="$t('articles.empty.owner.checklistTitle')" />

      <ul class="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
        <li v-for="step in rows" :key="step.id">
          <UPageCard
            v-if="!step.locked"
            :to="step.to"
            variant="ghost"
            :title="$t(`articles.empty.owner.steps.${step.id}.title`)"
            :description="$t(`articles.empty.owner.steps.${step.id}.description`)"
            :icon="step.done ? 'i-mdi-check-circle' : step.icon"
          />
          <UAlert
            v-else
            color="neutral"
            variant="subtle"
            icon="i-mdi-lock-outline"
            :title="$t(`articles.empty.owner.steps.${step.id}.title`)"
            :description="$t('articles.empty.owner.locked')"
          />
        </li>
      </ul>
    </UCard>

    <UButton :to="localePath({ name: 'admin' })" color="neutral" variant="link" trailingIcon="i-mdi-arrow-right">
      {{ $t('articles.empty.owner.adminCta') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { EmptySetupStepId, EmptySiteInfo } from '~~/shared/utils/emptySite'

import { buildEmptySetupSteps, emptySetupProgress } from '~~/shared/utils/emptySite'

const { site } = defineProps<{ site?: EmptySiteInfo | null }>()

const localePath = useLocalePath()
const status = await useClientSiteStatus()

const stepMeta: Record<EmptySetupStepId, { icon: string; to: () => RouteLocationRaw }> = {
  article: {
    icon: 'i-mdi-file-document-edit-outline',
    to: () => localePath({ name: 'admin-editor-id', params: { id: 'new' } }),
  },
  branding: {
    icon: 'i-mdi-palette-outline',
    to: () => localePath({ name: 'settings', query: { tab: 'branding' } }),
  },
  voice: {
    icon: 'i-mdi-robot-outline',
    to: () => localePath({ name: 'settings', query: { tab: 'content' } }),
  },
  domain: {
    icon: 'i-mdi-web-check',
    to: () => localePath({ name: 'admin' }),
  },
}

const steps = computed(() => buildEmptySetupSteps({ ...site, focus: status?.focus, audience: status?.audience }))
const progress = computed(() => emptySetupProgress(steps.value))
const rows = computed(() => steps.value.map((step) => ({ ...step, ...stepMeta[step.id], to: stepMeta[step.id].to() })))
</script>
