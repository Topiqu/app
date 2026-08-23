<template>
  <div class="flex flex-col items-center gap-5">
    <h1 class="text-balance text-4xl font-black tracking-tight text-highlighted sm:text-5xl lg:text-6xl">
      {{ site?.name ?? $t('common.labels.title') }}
    </h1>
    <USeparator class="max-w-12" />

    <p v-if="site?.tagline" class="text-sm font-semibold text-primary">{{ site.tagline }}</p>

    <p v-if="site?.description" class="max-w-xl text-balance text-lg leading-relaxed text-muted">
      {{ site.description }}
    </p>

    <UBadge color="neutral" variant="soft" icon="i-mdi-clock-outline">
      {{ $t('articles.empty.badge') }}
    </UBadge>

    <div class="space-y-2 pt-2">
      <h2 class="text-2xl font-bold tracking-tight text-highlighted">
        {{ $t('articles.empty.title') }}
      </h2>
      <p class="max-w-md text-balance text-base text-muted">
        {{ $t('articles.empty.message') }}
      </p>
    </div>

    <UButton to="#articles" color="neutral" variant="solid" class="publication-primary-cta" data-primary-cta>
      {{ $t('articles.home.browseArticles') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import type { EmptySiteInfo } from '~~/shared/utils/emptySite'

defineProps<{ site?: EmptySiteInfo | null }>()
</script>
