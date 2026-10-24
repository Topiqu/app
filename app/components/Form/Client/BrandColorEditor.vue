<template>
  <div class="@container min-w-0 space-y-6">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <URadioGroup
          :modelValue="accentColor ? undefined : theme"
          :items="colorItems"
          variant="card"
          indicator="hidden"
          orientation="horizontal"
          :aria-label="$t('common.preferences.branding.presetColors')"
          :ui="{
            root: 'contents',
            fieldset: 'contents',
            item: 'relative size-8 shrink-0 cursor-pointer rounded-full border-0 p-0 ring-1 ring-black/10 transition-shadow has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-inverted has-data-[state=checked]:ring-offset-2 has-data-[state=checked]:ring-offset-(--ui-bg) has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-primary dark:ring-white/15',
            wrapper: 'absolute inset-0 m-0',
            label: 'size-full',
            container: 'sr-only',
          }"
          @update:modelValue="selectPreset($event as ThemeKey)"
        >
          <template #label="{ item }">
            <span
              class="grid size-full place-items-center rounded-full"
              :style="{
                backgroundColor: themeColors[item.value as ThemeKey],
                color: contrastRatio(themeColors[item.value as ThemeKey], '#FFFFFF') >= 3 ? '#FFFFFF' : '#0F172A',
              }"
              :title="item.label"
            >
              <span class="sr-only">{{ item.label }}</span>
              <UIcon
                name="mdi:check-bold"
                size="18"
                :class="(accentColor || theme !== item.value) && 'invisible'"
                aria-hidden="true"
              />
            </span>
          </template>
        </URadioGroup>
        <FormClientBrandColorInput
          :modelValue="currentColor"
          :label="$t('common.preferences.branding.customColor')"
          display="swatch"
          :class="accentColor && 'rounded-full ring-2 ring-inverted ring-offset-2 ring-offset-(--ui-bg)'"
          @update:modelValue="emit('update:accentColor', $event)"
        />
      </div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          class="size-3.5 shrink-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15"
          :style="{ backgroundColor: currentColor }"
          aria-hidden="true"
        />
        <p class="text-sm font-medium text-muted" aria-live="polite">{{ selectedColorLabel }}</p>
        <FormClientBrandColorInput
          :modelValue="currentColor"
          :label="$t('common.preferences.branding.customColor')"
          display="hex"
          class="w-28"
          @update:modelValue="emit('update:accentColor', $event)"
        />
      </div>
      <UTooltip :text="$t('common.preferences.branding.fromLogoNeedsLogo')" :disabled="!!logoUrl">
        <span class="inline-flex">
          <UButton
            type="button"
            color="neutral"
            variant="link"
            size="sm"
            icon="mdi:eyedropper-variant"
            :loading="suggesting"
            :disabled="!logoUrl || !clientId"
            @click="suggestFromLogo"
          >
            {{ $t('common.preferences.branding.fromLogo') }}
          </UButton>
        </span>
      </UTooltip>
    </div>
    <p v-if="suggestionError" role="status" class="text-sm text-warning">
      {{ $t('common.preferences.branding.noLogoColors') }}
    </p>
    <div v-if="suggestions.length" class="flex flex-wrap items-center gap-2.5">
      <span class="text-xs text-muted">{{ $t('common.preferences.branding.logoSuggestions') }}</span>
      <UButton
        v-for="color in suggestions"
        :key="color"
        type="button"
        color="neutral"
        variant="outline"
        size="sm"
        square
        :title="color"
        :aria-label="color"
        @click="emit('update:accentColor', color)"
      >
        <span
          class="size-5 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15"
          :style="{ backgroundColor: color }"
        />
      </UButton>
    </div>

    <div>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">{{ $t('common.preferences.branding.gradient') }}</p>
          <p class="mt-0.5 text-xs text-muted">{{ $t('common.preferences.branding.gradientHelp') }}</p>
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
      <URadioGroup
        :modelValue="selectedGradientPreset"
        :items="gradientPresets"
        variant="card"
        indicator="hidden"
        orientation="horizontal"
        :aria-label="$t('common.preferences.branding.gradient')"
        class="mt-4"
        :ui="{
          fieldset: 'grid grid-cols-2 gap-2 @xs:grid-cols-4',
          item: 'min-w-0 cursor-pointer rounded-(--ui-radius) border-default p-1.5 transition-colors hover:border-accented has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
          wrapper: 'm-0 block min-w-0 w-full',
          label: 'min-w-0 w-full font-normal',
          container: 'sr-only',
        }"
        @update:modelValue="applyGradientPreset(String($event))"
      >
        <template #label="{ item }">
          <span
            class="block h-8 w-full rounded-[calc(var(--ui-radius)-0.25rem)]"
            :style="{ background: item.gradient ? gradientCss(item.gradient) : currentColor }"
            aria-hidden="true"
          />
          <span class="mt-1.5 block whitespace-normal break-words text-center text-xs text-default">{{
            item.label
          }}</span>
        </template>
      </URadioGroup>
      <template v-if="brandGradient && advanced">
        <UCollapsible class="mt-3">
          <UButton
            type="button"
            color="neutral"
            variant="link"
            size="sm"
            trailingIcon="mdi:chevron-down"
            class="group -ml-1"
            :ui="{ trailingIcon: 'transition-transform group-data-[state=open]:rotate-180' }"
            :label="$t('common.preferences.branding.gradientCustomize')"
          >
            <template #leading>
              <span
                class="h-4 w-10 rounded ring-1 ring-black/10 dark:ring-white/15"
                :style="{ background: gradientCss(brandGradient) }"
                aria-hidden="true"
              />
            </template>
          </UButton>
          <template #content>
            <div class="@container mt-2 space-y-4 rounded-lg border border-default p-3">
              <div class="grid gap-3 @md:grid-cols-3">
                <UFormField
                  v-for="(color, index) in brandGradient.colors"
                  :key="index"
                  :label="$t('common.preferences.branding.gradientStop', { number: index + 1 })"
                >
                  <FormClientBrandColorInput
                    :modelValue="color"
                    :label="$t('common.preferences.branding.gradientStop', { number: index + 1 })"
                    @update:modelValue="setStop(index, $event)"
                  />
                </UFormField>
              </div>
              <UFormField :label="$t('common.preferences.branding.gradientAngle')" :hint="`${brandGradient.angle}°`">
                <USlider
                  :modelValue="brandGradient.angle"
                  :min="0"
                  :max="360"
                  :step="15"
                  :aria-label="$t('common.preferences.branding.gradientAngle')"
                  @update:modelValue="updateGradient({ angle: Number($event) || 0 })"
                />
              </UFormField>
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                size="sm"
                :icon="brandGradient.colors.length === 2 ? 'mdi:plus' : 'mdi:minus'"
                @click="toggleThirdStop"
              >
                {{
                  brandGradient.colors.length === 2
                    ? $t('common.preferences.branding.addGradientStop')
                    : $t('common.preferences.branding.removeGradientStop')
                }}
              </UButton>
            </div>
          </template>
        </UCollapsible>
        <div
          v-if="accentMismatch"
          class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default bg-elevated/50 px-3 py-2"
        >
          <p class="text-xs text-muted">{{ $t('common.preferences.branding.gradientAccentMismatch') }}</p>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            size="xs"
            @click="emit('update:accentColor', brandGradient.colors[0]!)"
          >
            <template #leading>
              <span
                class="size-3 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                :style="{ backgroundColor: brandGradient.colors[0] }"
                aria-hidden="true"
              />
            </template>
            {{ $t('common.preferences.branding.useGradientAccent') }}
          </UButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ThemeKey } from '~~/shared/utils/tenantTheme'
import type { BrandGradient } from '~~/shared/utils/publicationBranding'

const props = defineProps<{
  theme: ThemeKey
  accentColor: string
  brandGradient: BrandGradient | null
  logoUrl: string
  clientId: string
  plan: string
}>()
const emit = defineEmits<{
  'update:theme': [theme: ThemeKey]
  'update:accentColor': [color: string]
  'update:brandGradient': [gradient: BrandGradient | null]
}>()

const localePath = useLocalePath()
const themes: ThemeKey[] = [
  'indigo',
  'blue',
  'sky',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'amber',
  'orange',
  'red',
  'pink',
  'purple',
  'violet',
  'gray',
]
const advanced = computed(() => hasAdvancedBranding(props.plan))
const currentColor = computed(() => resolveBrandAccent(props.theme, props.accentColor))
const selectedColorLabel = computed(() =>
  props.accentColor
    ? $t('common.preferences.branding.customColor')
    : $t(`common.preferences.branding.colors.${props.theme}`),
)
// Presets derive from the accent; only hand-picked stops can drift away from it.
const accentMismatch = computed(
  () =>
    advanced.value &&
    !!props.brandGradient &&
    !props.brandGradient.colors.some((color) => color.toUpperCase() === currentColor.value.toUpperCase()),
)
const suggestions = shallowRef<string[]>([])
const suggesting = shallowRef(false)
const suggestionError = shallowRef(false)
const gradientValue = computed<BrandGradient>(
  () => props.brandGradient ?? { colors: [currentColor.value, '#0F172A'], angle: 135 },
)
const colorItems = computed(() =>
  themes.map((value) => ({ value, label: $t(`common.preferences.branding.colors.${value}`) })),
)
const gradientPresets = computed(() => {
  const color = currentColor.value
  const presets: { value: string; label: string; gradient: BrandGradient | null; disabled?: boolean }[] = [
    { value: 'none', label: $t('common.none'), gradient: null },
    {
      value: 'soft',
      label: $t('common.preferences.branding.gradientSoft'),
      gradient: { colors: [color, mixBrandColor(color, '#FFFFFF', 0.65)], angle: 135 },
    },
    {
      value: 'deep',
      label: $t('common.preferences.branding.gradientDeep'),
      gradient: { colors: [mixBrandColor(color, '#0F172A', 0.45), color], angle: 120 },
    },
    {
      value: 'three',
      label: $t('common.preferences.branding.gradientThree'),
      gradient: {
        colors: [color, mixBrandColor(color, '#FFFFFF', 0.55), mixBrandColor(color, '#0F172A', 0.35)],
        angle: 90,
      },
    },
  ]
  return presets.map((preset) => ({ ...preset, disabled: preset.value !== 'none' && !advanced.value }))
})
// Presets derive from the accent, so a stored gradient stops matching one once the accent changes.
const selectedGradientPreset = computed(() => {
  const current = props.brandGradient
  if (!current) return 'none'
  const key = (g: BrandGradient) => `${g.angle}:${g.colors.join().toUpperCase()}`
  return gradientPresets.value.find((preset) => preset.gradient && key(preset.gradient) === key(current))?.value
})

const selectPreset = (theme: ThemeKey) => {
  emit('update:theme', theme)
  emit('update:accentColor', '')
}
const applyGradientPreset = (value: string) => {
  const preset = gradientPresets.value.find((option) => option.value === value)
  if (preset && !preset.disabled) emit('update:brandGradient', preset.gradient)
}
const updateGradient = (patch: Partial<BrandGradient>) => {
  if (!advanced.value) return
  emit('update:brandGradient', { ...gradientValue.value, ...patch })
}
const setStop = (index: number, color: string) => {
  const colors = [...gradientValue.value.colors]
  colors[index] = color
  updateGradient({ colors })
}
const toggleThirdStop = () => {
  const colors =
    gradientValue.value.colors.length === 2
      ? [gradientValue.value.colors[0]!, '#5B8DEF', gradientValue.value.colors[1]!]
      : [gradientValue.value.colors[0]!, gradientValue.value.colors[2]!]
  updateGradient({ colors })
}
const suggestFromLogo = async () => {
  if (!props.logoUrl || !props.clientId) return
  suggesting.value = true
  suggestionError.value = false
  try {
    const result = await $fetch<{ colors: string[] }, '/api/clients/:id/palette'>(
      `/api/clients/${props.clientId}/palette` as '/api/clients/:id/palette',
      {
        method: 'POST',
        body: { logoUrl: props.logoUrl },
      },
    )
    suggestions.value = result.colors
    suggestionError.value = !result.colors.length
  } catch {
    suggestionError.value = true
  } finally {
    suggesting.value = false
  }
}
</script>
