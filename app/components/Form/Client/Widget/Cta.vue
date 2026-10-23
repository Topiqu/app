<template>
  <div class="space-y-4">
    <UFormField :label="$t('widgets.cta.title')">
      <UInput v-model="config.title" :maxlength="80" class="w-full" />
    </UFormField>
    <UFormField :label="$t('widgets.cta.text')" :hint="`${config.text.length}/280`">
      <UTextarea v-model="config.text" :maxlength="280" :rows="2" autoresize class="w-full" />
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('widgets.link.url')" :hint="$t('widgets.link.hint')">
        <UInput v-model="config.button.url" inputmode="url" placeholder="https://…" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.cta.button')">
        <UInput v-model="config.button.label" :maxlength="40" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.tone')">
        <USelect v-model="config.tone" :items="toneItems" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.cta.image')">
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="soft" icon="mdi:image-outline" @click="pickerOpen = true">
            {{ config.image ? $t('widgets.cta.changeImage') : $t('widgets.cta.pickImage') }}
          </UButton>
          <UButton
            v-if="config.image"
            color="neutral"
            variant="ghost"
            icon="mdi:close"
            :aria-label="$t('widgets.cta.removeImage')"
            @click="config.image = null"
          />
        </div>
      </UFormField>
    </div>
    <LazyMediaPicker v-if="pickerOpen" v-model:open="pickerOpen" @select="select" />
  </div>
</template>

<script setup lang="ts">
import type { CtaConfig } from '~~/shared/utils/widgets'
import type { MediaPickerSelection } from '~~/shared/types/mediaLibrary'

const config = defineModel<CtaConfig>('config', { required: true })
const { t } = useI18n()
const pickerOpen = shallowRef(false)

const toneItems = computed(() =>
  (['accent', 'info'] as const).map((value) => ({ value, label: t(`widgets.tones.${value}`) })),
)

// The URL is for the preview only; the server replaces it with the asset's own on save.
function select(asset: MediaPickerSelection, altText: string) {
  config.value.image = { assetId: asset.id, url: asset.deliveryUrl ?? asset.url, alt: altText }
}
</script>
