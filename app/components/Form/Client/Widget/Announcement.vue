<template>
  <div class="space-y-4">
    <UFormField :label="$t('widgets.announcement.text')" :hint="`${config.text.length}/200`">
      <UTextarea v-model="config.text" :maxlength="200" :rows="2" autoresize class="w-full" />
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="$t('widgets.link.url')" :hint="$t('widgets.link.hint')">
        <UInput v-model="linkUrl" inputmode="url" placeholder="https://…" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.link.label')">
        <UInput v-model="linkLabel" :maxlength="40" class="w-full" />
      </UFormField>
      <UFormField :label="$t('widgets.tone')">
        <USelect v-model="config.tone" :items="toneItems" class="w-full" />
      </UFormField>
      <div class="flex items-end pb-1.5">
        <UFormField>
          <USwitch v-model="config.dismissible" :label="$t('widgets.announcement.dismissible')" />
        </UFormField>
      </div>
      <UFormField :label="$t('widgets.startsAt')">
        <AppDateInput v-model="startsAt" time />
      </UFormField>
      <UFormField :label="$t('widgets.endsAt')">
        <AppDateInput v-model="endsAt" time :min="startsAt || undefined" />
      </UFormField>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ANNOUNCEMENT_TONES, type AnnouncementConfig } from '~~/shared/utils/widgets'

const config = defineModel<AnnouncementConfig>('config', { required: true })
const { t } = useI18n()

const toneItems = computed(() => ANNOUNCEMENT_TONES.map((value) => ({ value, label: t(`widgets.tones.${value}`) })))

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
