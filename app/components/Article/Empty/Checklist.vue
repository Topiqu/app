<template>
  <UCard>
    <header class="flex items-center justify-between gap-4">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-muted">
        {{ $t('articles.empty.owner.checklistTitle') }}
      </h2>
      <span class="text-xs font-semibold tabular-nums text-muted">{{
        $t('articles.empty.owner.progress', progress)
      }}</span>
    </header>

    <UProgress class="mt-4" :modelValue="progress.percent" :aria-label="$t('articles.empty.owner.checklistTitle')" />

    <ul class="mt-2 divide-y divide-default">
      <li v-for="step in rows" :key="step.id">
        <UPageCard
          :to="step.to"
          variant="ghost"
          :title="$t(`articles.empty.owner.steps.${step.id}.title`)"
          :description="$t(`articles.empty.owner.steps.${step.id}.description`, { domain: site?.domain })"
          :icon="step.done ? 'mdi:check-circle' : step.icon"
          :ui="{ leadingIcon: step.done ? 'text-success' : undefined }"
        />
      </li>
    </ul>

    <p v-if="site?.domain" class="mt-3 flex flex-wrap items-center gap-x-2 border-t border-default pt-3 text-sm">
      <span class="text-muted">{{ $t('articles.empty.owner.address') }}</span>
      <UButton
        :to="`https://${site.domain}`"
        target="_blank"
        color="neutral"
        variant="link"
        size="sm"
        trailingIcon="mdi:open-in-new"
        :label="site.domain"
      />
    </p>
  </UCard>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { SetupStepId } from '~~/shared/utils/siteSetup'

import { buildSetupSteps, setupProgress } from '~~/shared/utils/siteSetup'

const localePath = useLocalePath()
const config = useRuntimeConfig()
const site = await useClientSite()
const { data: status } = await useClientSiteStatus()

const stepMeta: Record<SetupStepId, { icon: string; to: () => RouteLocationRaw }> = {
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
  buildSetupSteps(
    { ...site, focus: status.value?.focus, audience: status.value?.audience },
    String(config.public.baseDomain || 'topiqu.com'),
  ),
)
const progress = computed(() => setupProgress(steps.value))
const rows = computed(() =>
  steps.value.map((step) => ({ ...step, icon: stepMeta[step.id].icon, to: stepMeta[step.id].to() })),
)
</script>
