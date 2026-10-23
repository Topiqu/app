<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField :label="$t('widgets.divider.style')">
      <USelect v-model="config.style" :items="styleItems" class="w-full" />
    </UFormField>
    <UFormField :label="$t('widgets.divider.label')" :hint="$t('widgets.optional')">
      <UInput v-model="label" :maxlength="60" class="w-full" />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { DividerConfig } from '~~/shared/utils/widgets'

const config = defineModel<DividerConfig>('config', { required: true })
const { t } = useI18n()

const styleItems = computed(() =>
  DIVIDER_STYLES.map((value) => ({ value, label: t(`widgets.divider.styles.${value}`) })),
)
const label = computed({
  get: () => config.value.label ?? '',
  set: (value: string) => (config.value.label = value || null),
})
</script>
