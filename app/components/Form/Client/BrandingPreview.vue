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
      class="publication-surface overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default text-default"
      :class="darkPreview ? 'dark' : 'light'"
      :style="previewStyle"
    >
      <div>
        <header class="flex items-center gap-3 border-b border-default p-4" :style="heroStyle">
          <AppMedia
            :src="logoUrl"
            :fallbackText="name.trim().charAt(0)"
            :fallbackBorder="false"
            :alt="name"
            aspectRatio="1 / 1"
            fit="contain"
            sizes="40px"
            :width="80"
            :height="80"
            containerClass="size-10 shrink-0 rounded-(--ui-radius) bg-transparent"
            :style="logoStyle"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-base font-bold" :style="{ fontFamily: baseStyle['--topiqu-heading-font'] }">
              {{ name }}
            </p>
            <p v-if="tagline" class="line-clamp-2 break-words text-xs opacity-80">{{ tagline }}</p>
          </div>
          <span
            class="inline-flex shrink-0 items-center rounded-(--ui-radius) border px-3 py-1.5 text-xs font-semibold"
            :style="{ color: activeGradient ? 'inherit' : 'var(--ui-primary)', borderColor: 'currentColor' }"
          >
            {{ $t('widgets.presets.ctaNewsletter.button') }}
          </span>
        </header>
        <article class="m-3.5 rounded-(--ui-radius) border border-default bg-default p-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            {{ $t('common.preferences.branding.sampleCategory') }}
          </p>
          <h3
            class="text-xl font-bold leading-tight tracking-tight text-highlighted"
            :style="{ fontFamily: baseStyle['--topiqu-heading-font'] }"
          >
            {{ $t('common.preferences.branding.sampleTitle') }}
          </h3>
          <p class="mt-3 text-sm leading-relaxed text-muted">
            {{ description || $t('common.preferences.branding.sampleExcerpt') }}
          </p>
          <span class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {{ $t('common.readMore') }}
            <UIcon name="mdi:arrow-right" size="16" aria-hidden="true" />
          </span>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BrandGradient } from '~~/shared/utils/publicationBranding'
import type { PublicationTypography } from '~~/generated/zenstack/models'

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

const colorMode = useColorMode()
const previewMode = shallowRef<boolean | null>(null)
const darkPreview = computed({
  get: () => previewMode.value ?? colorMode.value === 'dark',
  set: (value: boolean) => {
    previewMode.value = value
  },
})
const baseStyle = computed(() =>
  tenantThemeStyle(props.currentTheme, props.typographyPreset, {
    accentColor: props.accentColor,
    brandGradient: props.brandGradient,
    plan: props.plan,
    headingFontUrl: props.headingFontUrl,
    bodyFontUrl: props.bodyFontUrl,
  }),
)
const activeGradient = computed(() => activeBrandGradient(props.brandGradient, props.plan))
const brandAccent = computed(() => resolveBrandAccent(props.currentTheme, props.accentColor))
const logoStyle = computed(() =>
  props.logoUrl
    ? undefined
    : {
        backgroundColor: brandAccent.value,
        '--ui-text-highlighted': contrastRatio(brandAccent.value, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#0F172A',
      },
)
const heroStyle = computed(() => {
  const gradient = activeGradient.value
  if (!gradient)
    return {
      background: `color-mix(in srgb, ${brandAccent.value} 10%, var(--ui-bg))`,
      color: 'var(--ui-text-highlighted)',
    }
  const minimumContrast = (foreground: string) =>
    Math.min(...gradient.colors.map((color) => contrastRatio(color, foreground)))
  return {
    background: gradientCss(gradient),
    color: minimumContrast('#ffffff') >= minimumContrast('#0f172a') ? '#ffffff' : '#0f172a',
  }
})
const previewStyle = computed(() => ({
  ...baseStyle.value,
  colorScheme: darkPreview.value ? 'dark' : 'light',
  '--ui-bg': darkPreview.value ? 'var(--color-neutral-900)' : 'var(--color-white)',
  '--ui-bg-elevated': darkPreview.value ? 'var(--color-neutral-800)' : 'var(--color-neutral-100)',
  '--ui-text': darkPreview.value ? 'var(--color-neutral-200)' : 'var(--color-neutral-700)',
  '--ui-text-highlighted': darkPreview.value ? 'var(--color-white)' : 'var(--color-neutral-900)',
  '--ui-text-muted': darkPreview.value ? 'var(--color-neutral-400)' : 'var(--color-neutral-600)',
  '--ui-border': darkPreview.value ? 'var(--color-neutral-700)' : 'var(--color-neutral-200)',
  '--ui-primary': darkPreview.value
    ? baseStyle.value['--topiqu-tenant-accent-dark']
    : baseStyle.value['--topiqu-tenant-accent-light'],
  '--topiqu-tenant-accent': darkPreview.value
    ? baseStyle.value['--topiqu-tenant-accent-dark']
    : baseStyle.value['--topiqu-tenant-accent-light'],
  '--topiqu-tenant-accent-foreground': darkPreview.value
    ? baseStyle.value['--topiqu-cta-dark-fg']
    : baseStyle.value['--topiqu-cta-fg'],
  '--topiqu-cta-bg': darkPreview.value ? baseStyle.value['--topiqu-cta-dark-bg'] : baseStyle.value['--topiqu-cta-bg'],
  '--topiqu-cta-hover': darkPreview.value
    ? baseStyle.value['--topiqu-cta-dark-hover']
    : baseStyle.value['--topiqu-cta-hover'],
  '--topiqu-cta-fg': darkPreview.value ? baseStyle.value['--topiqu-cta-dark-fg'] : baseStyle.value['--topiqu-cta-fg'],
  '--topiqu-cta-focus': darkPreview.value
    ? baseStyle.value['--topiqu-cta-dark-focus']
    : baseStyle.value['--topiqu-cta-focus'],
}))
</script>
