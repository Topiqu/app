<template>
  <div class="space-y-4">
    <UFormField :label="$t('widgets.announcement.text')" :hint="`${config.text.length}/200`">
      <FormClientWidgetAnnouncementText v-model:config="config" />
      <p class="mt-2 text-xs text-muted">{{ $t('widgets.announcement.formattingHint') }}</p>
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('widgets.link.url')" :hint="$t('widgets.link.hint')">
        <UInput v-model="linkUrl" inputmode="url" placeholder="https://…" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.link.label')">
        <UInput v-model="linkLabel" :maxlength="40" class="w-full" />
      </UFormField>
    </div>

    <FormClientWidgetAnnouncementAppearance v-model="appearance" v-model:tone="config.tone" />

    <div class="space-y-4 border-t border-default pt-5">
      <USwitch v-model="config.dismissible" :label="$t('widgets.announcement.dismissible')" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField :label="$t('widgets.startsAt')">
          <AppDateInput v-model="startsAt" time />
        </UFormField>
        <UFormField :label="$t('widgets.endsAt')">
          <AppDateInput v-model="endsAt" time :min="startsAt || undefined" />
        </UFormField>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_ANNOUNCEMENT_APPEARANCE, type AnnouncementConfig } from '~~/shared/utils/widgets'

const config = defineModel<AnnouncementConfig>('config', { required: true })
const appearance = computed({
  get: () => ({ ...DEFAULT_ANNOUNCEMENT_APPEARANCE, ...config.value.appearance }),
  set: (appearance) => (config.value = { ...config.value, appearance }),
})

// The link is one nullable object; the two inputs edit it as if it were always there.
const linkUrl = computed({
  get: () => config.value.link?.url ?? '',
  set: (url: string) => (config.value.link = { url, label: config.value.link?.label ?? '' }),
})
const linkLabel = computed({
  get: () => config.value.link?.label ?? '',
  set: (label: string) => (config.value.link = { url: config.value.link?.url ?? '', label }),
})
const startsAt = computed({
  get: () => isoToDateInput(config.value.startsAt),
  set: (value: string) => (config.value.startsAt = dateInputToIso(value)),
})
const endsAt = computed({
  get: () => isoToDateInput(config.value.endsAt),
  set: (value: string) => (config.value.endsAt = dateInputToIso(value)),
})
</script>
