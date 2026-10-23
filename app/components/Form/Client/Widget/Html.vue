<template>
  <div class="space-y-4">
    <UAlert
      color="neutral"
      variant="subtle"
      icon="mdi:shield-check-outline"
      :title="$t('widgets.html.sandboxTitle')"
      :description="$t('widgets.html.sandboxText')"
    />
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('widgets.html.title')" :hint="$t('widgets.html.titleHint')">
        <UInput v-model="config.title" :maxlength="80" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.html.height')" :hint="$t('widgets.html.heightHint')">
        <UInputNumber v-model="config.height" :min="40" :max="2000" :step="20" class="w-full" />
      </UFormField>
    </div>
    <UFormField :label="$t('widgets.html.code')" :hint="`${Math.ceil(bytes / 1000)} / ${MAX_HTML_BYTES / 1000} kB`">
      <UTextarea
        v-model="config.html"
        :rows="8"
        autoresize
        spellcheck="false"
        class="w-full"
        :ui="{ base: 'font-mono text-xs' }"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import type { HtmlConfig } from '~~/shared/utils/widgets'

const config = defineModel<HtmlConfig>('config', { required: true })
const bytes = computed(() => new TextEncoder().encode(config.value.html).length)
</script>
