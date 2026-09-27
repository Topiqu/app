<template>
  <div class="flex w-full flex-col items-center gap-8">
    <UBadge color="warning" variant="soft" icon="mdi:eye-off-outline">
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
      <UButton v-if="canGenerateAi" :to="editorLink({ ai: '1' })" icon="mdi:auto-fix" size="lg">
        {{ $t('articles.empty.owner.aiCta') }}
      </UButton>
      <UButton
        :to="editorLink()"
        icon="mdi:pencil-plus-outline"
        size="lg"
        :color="canGenerateAi ? 'neutral' : 'primary'"
        :variant="canGenerateAi ? 'outline' : 'solid'"
      >
        {{ $t(canGenerateAi ? 'articles.empty.owner.writeSelfCta' : 'articles.empty.owner.writeCta') }}
      </UButton>
    </div>

    <ArticleEmptyChecklist class="w-full text-left" />

    <div class="flex flex-wrap justify-center gap-x-6 gap-y-2">
      <UButton :to="{ query: { preview: 'visitor' } }" color="neutral" variant="link" icon="mdi:eye-outline">
        {{ $t('articles.empty.owner.previewCta') }}
      </UButton>
      <UButton :to="localePath({ name: 'admin' })" color="neutral" variant="link" trailingIcon="mdi:arrow-right">
        {{ $t('articles.empty.owner.adminCta') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SiteSetupInfo } from '~~/shared/utils/siteSetup'

import { hasAiPlan } from '~~/shared/utils/plans'

const { site } = defineProps<{ site?: SiteSetupInfo | null }>()

const localePath = useLocalePath()
const { data: status } = await useClientSiteStatus()
const canGenerateAi = computed(
  () => hasAiPlan(status.value?.plan ?? site?.plan) && Number(status.value?.articlesRemaining ?? 0) > 0,
)
const editorLink = (query?: Record<string, string>) =>
  localePath({ name: 'admin-editor-id', params: { id: 'new' }, query })
</script>
