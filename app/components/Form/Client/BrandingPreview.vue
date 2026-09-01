<template>
  <div
    data-publication-preview
    class="publication-surface rounded-(--topiqu-surface-radius) border border-default bg-default p-4"
    :style="previewStyle"
  >
    <div class="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div class="flex min-w-0 flex-col items-center justify-center py-3 text-center">
        <AppMedia
          :src="logoUrl"
          :fallbackText="name"
          :fallbackBorder="false"
          :alt="name"
          aspectRatio="1 / 1"
          fit="contain"
          sizes="128px"
          :width="256"
          :height="256"
          containerClass="aspect-square w-full max-w-28 rounded-[var(--ui-radius)] bg-transparent"
        />
        <h3 v-if="!logoUrl" class="sr-only">{{ name }}</h3>
        <p
          v-if="tagline"
          class="mt-3 max-w-[24ch] border-b-2 border-[var(--topiqu-tenant-accent)] px-2 pb-2 text-sm font-semibold leading-snug text-highlighted"
        >
          {{ tagline }}
        </p>
        <p v-if="description" class="mt-2 line-clamp-2 text-xs leading-5 text-muted">{{ description }}</p>
        <span
          class="publication-primary-cta mt-3 inline-flex rounded-[var(--ui-radius)] px-3 py-2 text-xs font-semibold"
        >
          {{ $t('articles.home.latestStory') }}
        </span>
      </div>

      <div class="overflow-hidden rounded-[var(--ui-radius)] border border-default bg-default">
        <div class="grid min-h-28 place-items-center bg-elevated text-muted">
          <UIcon name="mdi:image-outline" size="28" />
        </div>
        <div class="space-y-2 p-3">
          <div class="flex gap-1.5">
            <span class="h-5 w-12 rounded-full bg-primary/10" />
            <span class="h-5 w-8 rounded-full bg-primary/10" />
          </div>
          <div class="h-3 w-full rounded bg-muted" />
          <div class="h-3 w-4/5 rounded bg-muted" />
          <div class="h-2 w-3/5 rounded bg-elevated" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { logoUrl, name, tagline, description, currentTheme, typographyPreset } = defineProps<{
  logoUrl: string
  name: string
  tagline: string
  description: string
  currentTheme: string
  typographyPreset: 'MODERN' | 'EDITORIAL' | 'SYSTEM'
}>()

const previewStyle = computed(() => tenantThemeStyle(currentTheme, typographyPreset))
</script>
