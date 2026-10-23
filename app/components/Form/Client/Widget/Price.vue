<template>
  <div class="space-y-4">
    <UFormField :label="$t('widgets.price.assets')" :hint="$t('widgets.price.assetsHint')">
      <UCheckboxGroup
        v-model="config.assets"
        :items="assetItems"
        orientation="horizontal"
        :ui="{ fieldset: 'flex-wrap gap-x-4 gap-y-2' }"
      />
    </UFormField>
    <UFormField :label="$t('widgets.price.quote')" class="sm:max-w-xs">
      <USelect v-model="config.quote" :items="[...FIAT]" class="w-full" />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { PriceConfig } from '~~/shared/utils/widgets'

const config = defineModel<PriceConfig>('config', { required: true })

const assetItems = computed(() =>
  [...CRYPTO, ...FIAT].map((value) => ({ value, label: value, disabled: value === config.value.quote })),
)
</script>
