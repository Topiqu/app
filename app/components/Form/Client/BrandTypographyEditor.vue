<template>
  <div data-typography-editor class="@container min-w-0 space-y-6">
    <URadioGroup
      :modelValue="preset"
      :items="presets"
      variant="card"
      indicator="hidden"
      :aria-label="$t('common.preferences.branding.typography')"
      :ui="{
        fieldset: 'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 @md:grid-cols-2',
        item: 'min-w-0 cursor-pointer overflow-hidden rounded-(--topiqu-surface-radius) border-default bg-default px-3 py-2.5 transition-colors hover:border-accented has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
        wrapper: 'm-0 min-w-0 text-start',
        label: 'min-w-0 font-normal',
      }"
      @update:modelValue="emit('update:preset', $event as PublicationTypography)"
    >
      <template #label="{ item }">
        <span data-typography-preset class="block min-w-0">
          <span class="flex min-w-0 items-center justify-between gap-2">
            <span class="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-muted">
              {{ item.label }}
            </span>
            <UIcon
              name="mdi:check-circle"
              size="16"
              class="shrink-0 text-primary"
              :class="preset !== item.value && 'invisible'"
            />
          </span>
          <span
            class="mt-1 block min-w-0 text-base font-semibold leading-snug text-highlighted [overflow-wrap:anywhere]"
            :style="{ fontFamily: item.fonts.heading }"
          >
            {{ $t('common.preferences.branding.sampleTitle') }}
          </span>
          <span class="mt-0.5 block min-w-0 truncate text-sm text-muted" :style="{ fontFamily: item.fonts.body }">
            {{ $t('common.preferences.branding.sampleExcerpt') }}
          </span>
        </span>
      </template>
    </URadioGroup>

    <div>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">{{ $t('common.preferences.branding.customFont') }}</p>
          <p class="mt-0.5 text-xs text-muted">{{ $t('common.preferences.branding.customFontHelp') }}</p>
        </div>
        <UButton
          v-if="!advanced"
          :to="localePath({ name: 'settings', query: { tab: 'billing' } })"
          color="neutral"
          variant="soft"
          size="xs"
          icon="mdi:lock-outline"
          class="shrink-0"
          :label="$t('common.preferences.branding.unlockPro')"
        />
      </div>
      <div v-if="advanced" class="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 @md:grid-cols-2">
        <FormClientBrandFontSlot
          fontRole="heading"
          :clientId
          :url="headingFontUrl"
          @update:url="updateFont('heading', $event)"
        />
        <FormClientBrandFontSlot
          fontRole="body"
          :clientId
          :url="bodyFontUrl"
          @update:url="updateFont('body', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { hasAdvancedBranding } from '~~/shared/utils/publicationBranding'

import { tenantFontFaceCss, typographyFonts, type PublicationTypography } from '~/composables/theme'

const props = defineProps<{
  preset: PublicationTypography
  headingFontUrl: string
  bodyFontUrl: string
  clientId: string
  plan: string
}>()
const emit = defineEmits<{
  'update:preset': [preset: PublicationTypography]
  'update:headingFontUrl': [url: string]
  'update:bodyFontUrl': [url: string]
}>()
const localePath = useLocalePath()
const advanced = computed(() => hasAdvancedBranding(props.plan))
const presets = computed(() => {
  const values: PublicationTypography[] = ['MODERN', 'EDITORIAL', 'MAGAZINE', 'SYSTEM']
  if (advanced.value && (props.headingFontUrl || props.bodyFontUrl)) values.push('CUSTOM')
  return values.map((value) => ({
    value,
    label: $t(`common.preferences.branding.${value.toLowerCase()}`),
    fonts: typographyFonts(value, props.headingFontUrl, props.bodyFontUrl),
  }))
})
const updateFont = (slot: 'heading' | 'body', url: string) => {
  if (slot === 'heading') emit('update:headingFontUrl', url)
  else emit('update:bodyFontUrl', url)
  if (url) emit('update:preset', 'CUSTOM')
  else if (props.preset === 'CUSTOM' && !(slot === 'heading' ? props.bodyFontUrl : props.headingFontUrl))
    emit('update:preset', 'MODERN')
}
const cdnUrl = useRuntimeConfig().public.cdnUrl
useHead(() => {
  const css = tenantFontFaceCss(props.clientId, cdnUrl, 'CUSTOM', {
    plan: props.plan,
    headingFontUrl: props.headingFontUrl,
    bodyFontUrl: props.bodyFontUrl,
  })
  return { style: css ? [{ key: 'branding-preview-fonts', innerHTML: css }] : [] }
})
</script>
