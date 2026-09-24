<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm font-semibold text-highlighted">{{ $t('common.preferences.branding.livePreview') }}</span>
      <UButton
        type="button"
        size="xs"
        color="neutral"
        variant="soft"
        :icon="darkPreview ? 'mdi:weather-sunny' : 'mdi:weather-night'"
        @click="darkPreview = !darkPreview"
      >
        {{
          darkPreview ? $t('common.preferences.branding.lightPreview') : $t('common.preferences.branding.darkPreview')
        }}
      </UButton>
    </div>
    <div
      data-publication-preview
      class="publication-surface overflow-hidden rounded-(--topiqu-surface-radius) border border-default shadow-sm"
      :style="previewStyle"
    >
      <div
        class="h-2"
        :style="{ background: activeGradient ? gradientCss(activeGradient) : accent }"
        aria-hidden="true"
      />
      <div class="p-5">
        <header
          class="flex items-center gap-3 border-b pb-4"
          :style="{ borderColor: darkPreview ? '#374151' : '#e5e7eb' }"
        >
          <AppMedia
            :src="logoUrl"
            :fallbackText="name"
            :fallbackBorder="false"
            :alt="name"
            aspectRatio="16 / 5"
            fit="contain"
            sizes="96px"
            :width="256"
            containerClass="h-10 w-24 shrink-0 bg-transparent"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-bold">{{ name }}</p>
            <p v-if="tagline" class="line-clamp-1 text-xs opacity-70">{{ tagline }}</p>
          </div>
        </header>
        <article class="pt-5">
          <p
            class="mb-2 text-xs font-semibold uppercase tracking-wider"
            :style="{
              color: darkPreview ? baseStyle['--topiqu-tenant-accent-dark'] : baseStyle['--topiqu-tenant-accent-light'],
            }"
          >
            {{ $t('common.preferences.branding.sampleCategory') }}
          </p>
          <h3
            class="text-2xl font-bold leading-tight tracking-tight"
            :style="{ fontFamily: baseStyle['--topiqu-heading-font'] }"
          >
            {{ $t('common.preferences.branding.sampleTitle') }}
          </h3>
          <p class="mt-3 text-sm leading-relaxed opacity-75">
            {{ description || $t('common.preferences.branding.sampleExcerpt') }}
          </p>
          <p class="mt-3 text-sm leading-relaxed">
            {{ $t('common.preferences.branding.sampleBody') }}
          </p>
          <span
            class="publication-primary-cta mt-5 inline-flex rounded-[var(--ui-radius)] px-4 py-2 text-xs font-semibold"
          >
            {{ $t('articles.home.latestStory') }}
          </span>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BrandGradient } from '~~/shared/utils/publicationBranding'

import { gradientCss, hasAdvancedBranding, parseBrandGradient } from '~~/shared/utils/publicationBranding'

import { resolveBrandAccent, tenantThemeStyle, type PublicationTypography } from '~/composables/theme'

const props = defineProps<{
  logoUrl: string
  name: string
  tagline: string
  description: string
  currentTheme: string
  typographyPreset: PublicationTypography
  accentColor: string
  brandGradient: BrandGradient | null
  headingFontUrl: string
  bodyFontUrl: string
  plan: string
}>()

const darkPreview = shallowRef(false)
const baseStyle = computed(() =>
  tenantThemeStyle(props.currentTheme, props.typographyPreset, {
    accentColor: props.accentColor,
    brandGradient: props.brandGradient,
    plan: props.plan,
    headingFontUrl: props.headingFontUrl,
    bodyFontUrl: props.bodyFontUrl,
  }),
)
const activeGradient = computed(() =>
  hasAdvancedBranding(props.plan) ? parseBrandGradient(props.brandGradient) : null,
)
const accent = computed(() => resolveBrandAccent(props.currentTheme, props.accentColor))
const previewStyle = computed(() => ({
  ...baseStyle.value,
  backgroundColor: darkPreview.value ? '#111827' : '#ffffff',
  color: darkPreview.value ? '#f8fafc' : '#111827',
  '--topiqu-cta-bg': darkPreview.value ? baseStyle.value['--topiqu-cta-dark-bg'] : baseStyle.value['--topiqu-cta-bg'],
  '--topiqu-cta-hover': darkPreview.value
    ? baseStyle.value['--topiqu-cta-dark-hover']
    : baseStyle.value['--topiqu-cta-hover'],
  '--topiqu-cta-fg': darkPreview.value ? baseStyle.value['--topiqu-cta-dark-fg'] : baseStyle.value['--topiqu-cta-fg'],
}))
</script>
