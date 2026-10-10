<template>
  <section class="space-y-4 border-t border-default pt-5" :aria-labelledby="headingId">
    <h3 :id="headingId" class="text-sm font-semibold text-highlighted">{{ $t('widgets.announcement.appearance') }}</h3>

    <div class="grid grid-cols-2 gap-4">
      <UFormField :label="$t('widgets.announcement.alignment')">
        <USelect v-model="alignment" :items="alignmentItems" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.announcement.textSize')">
        <USelect v-model="textSize" :items="textSizeItems" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.announcement.spacing')">
        <USelect v-model="spacing" :items="spacingItems" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.announcement.linkStyle')">
        <USelect v-model="linkStyle" :items="linkStyleItems" class="w-full" />
      </UFormField>
    </div>

    <UFormField v-if="!customColors" :label="$t('widgets.tone')">
      <USelect v-model="tone" :items="toneItems" class="w-full" />
    </UFormField>
    <USwitch v-model="customColors" :label="$t('widgets.announcement.customColors')" />
    <div v-if="customColors" class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('widgets.announcement.backgroundColor')">
        <FormClientBrandColorInput v-model="backgroundColor" :label="$t('widgets.announcement.backgroundColor')" />
      </UFormField>
      <UFormField :label="$t('widgets.announcement.textColor')">
        <FormClientBrandColorInput v-model="textColor" :label="$t('widgets.announcement.textColor')" />
      </UFormField>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  ANNOUNCEMENT_ALIGNMENTS,
  ANNOUNCEMENT_LINK_STYLES,
  ANNOUNCEMENT_SPACINGS,
  ANNOUNCEMENT_TEXT_SIZES,
  ANNOUNCEMENT_TONES,
  type AnnouncementAppearance,
  type AnnouncementConfig,
} from '~~/shared/utils/widgets'

const appearance = defineModel<AnnouncementAppearance>({ required: true })
const tone = defineModel<AnnouncementConfig['tone']>('tone', { required: true })
const { t } = useI18n()
const headingId = useId()

const alignmentItems = computed(() =>
  ANNOUNCEMENT_ALIGNMENTS.map((value) => ({ value, label: t(`widgets.announcement.alignments.${value}`) })),
)
const textSizeItems = computed(() =>
  ANNOUNCEMENT_TEXT_SIZES.map((value) => ({ value, label: t(`widgets.announcement.textSizes.${value}`) })),
)
const spacingItems = computed(() =>
  ANNOUNCEMENT_SPACINGS.map((value) => ({ value, label: t(`widgets.announcement.spacings.${value}`) })),
)
const linkStyleItems = computed(() =>
  ANNOUNCEMENT_LINK_STYLES.map((value) => ({ value, label: t(`widgets.announcement.linkStyles.${value}`) })),
)
const toneItems = computed(() => ANNOUNCEMENT_TONES.map((value) => ({ value, label: t(`widgets.tones.${value}`) })))

// Replace the model so edits also reach parents that normalize older configurations with a computed.
function field<K extends keyof AnnouncementAppearance>(key: K) {
  return computed({
    get: () => appearance.value[key],
    set: (value: AnnouncementAppearance[K]) => (appearance.value = { ...appearance.value, [key]: value }),
  })
}
const alignment = field('alignment')
const textSize = field('textSize')
const spacing = field('spacing')
const linkStyle = field('linkStyle')

const customColors = computed({
  get: () => appearance.value.colors !== null,
  set: (enabled: boolean) =>
    (appearance.value = {
      ...appearance.value,
      colors: enabled ? { background: '#18181B', text: '#FFFFFF' } : null,
    }),
})
const backgroundColor = computed({
  get: () => appearance.value.colors?.background ?? '#18181B',
  set: (background: string) =>
    (appearance.value = { ...appearance.value, colors: { background, text: textColor.value } }),
})
const textColor = computed({
  get: () => appearance.value.colors?.text ?? '#FFFFFF',
  set: (text: string) =>
    (appearance.value = { ...appearance.value, colors: { background: backgroundColor.value, text } }),
})
</script>
