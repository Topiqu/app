<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-2xl font-extrabold text-highlighted tracking-tight">
        {{ $t('landing.onboarding.designFocus') }}
      </h3>
      <p class="text-[1.05rem] text-muted font-medium leading-relaxed">
        {{ $t('landing.onboarding.designFocusDesc') }}
      </p>
    </div>

    <div class="space-y-8">
      <div>
        <UFormField :label="$t('landing.onboarding.mainLanguage')">
          <URadioGroup
            v-model="form.language"
            :items="languageOptions"
            valueKey="value"
            orientation="horizontal"
            variant="card"
            class="grid grid-cols-2"
          >
            <template #label="{ item }">
              <span class="flex items-center gap-3 py-2">
                <span class="text-3xl">{{ item.flag }}</span>
                <span class="font-bold">{{ item.label }}</span>
              </span>
            </template>
          </URadioGroup>
        </UFormField>
      </div>

      <UFormField :label="$t('landing.onboarding.mainColor')">
        <div class="flex items-center gap-3">
          <UColorPicker v-model="themeHex" />
          <UBadge color="neutral" variant="soft">{{ form.theme }}</UBadge>
        </div>
      </UFormField>

      <UFormField :label="$t('landing.onboarding.siteFocus')">
        <UInput
          v-model="form.focus"
          :placeholder="$t('landing.onboarding.siteFocusPlaceholder')"
          leadingIcon="i-mdi-target"
          class="w-full"
        />
      </UFormField>
    </div>

    <div class="flex gap-4 mt-10">
      <UButton type="button" color="neutral" variant="soft" size="lg" class="w-1/3" @click="goBack(1)">
        {{ $t('common.actions.back') }}
      </UButton>
      <UButton type="submit" color="primary" variant="solid" size="lg" class="w-2/3" trailingIcon="i-mdi-arrow-right">
        {{ $t('landing.onboarding.continueToAccount') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t: $t } = useI18n()
const { form, goBack } = useOnboarding()

const themeOptions = [
  { label: 'Blue', value: 'blue', hex: '#3b82f6' },
  { label: 'Indigo', value: 'indigo', hex: '#6366f1' },
  { label: 'Purple', value: 'purple', hex: '#a855f7' },
  { label: 'Pink', value: 'pink', hex: '#ec4899' },
  { label: 'Red', value: 'red', hex: '#ef4444' },
  { label: 'Orange', value: 'orange', hex: '#f97316' },
  { label: 'Green', value: 'green', hex: '#22c55e' },
  { label: 'Teal', value: 'teal', hex: '#14b8a6' },
] as const
type ThemeValue = (typeof themeOptions)[number]['value']

const rgb = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
const themeHex = computed({
  get: () => themeOptions.find((option) => option.value === form.theme)?.hex ?? themeOptions[0].hex,
  set: (hex: string) => {
    const target = rgb(hex)
    const option = themeOptions.reduce(
      (closest, candidate) => {
        const distance = rgb(candidate.hex).reduce((sum, channel, index) => sum + (channel - target[index]!) ** 2, 0)
        return distance < closest.distance ? { value: candidate.value, distance } : closest
      },
      { value: themeOptions[0].value as ThemeValue, distance: Number.POSITIVE_INFINITY },
    )
    form.theme = option.value
  },
})

const languageOptions = computed(() => [
  { value: 'cs', flag: '🇨🇿', label: $t('landing.onboarding.langCz') },
  { value: 'en', flag: '🇬🇧', label: $t('landing.onboarding.langEn') },
])
</script>
