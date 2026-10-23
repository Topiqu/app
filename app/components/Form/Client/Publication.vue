<template>
  <section class="space-y-4">
    <div>
      <h3 class="text-base font-semibold text-highlighted">{{ $t('common.preferences.aiPage.automation') }}</h3>
      <p class="mt-1 text-sm text-muted">{{ $t('common.preferences.aiPage.automationDescription') }}</p>
    </div>

    <div class="overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default">
      <div class="flex items-center gap-3 border-b border-default px-4 py-4 sm:px-5">
        <UIcon
          :name="autoRelease ? 'mdi:publish' : 'mdi:file-document-edit-outline'"
          class="hidden size-5 shrink-0 text-muted sm:block"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-highlighted">{{ $t('common.preferences.autoRelease.title') }}</p>
          <p class="mt-0.5 text-sm leading-5 text-muted">
            {{ autoRelease ? $t('common.preferences.autoRelease.warning') : $t('common.preferences.autoRelease.desc') }}
          </p>
        </div>
        <USwitch
          :modelValue="autoRelease"
          :aria-label="$t('common.preferences.autoRelease.title')"
          @update:modelValue="emit('update:autoRelease', $event as boolean)"
        />
      </div>

      <div class="p-4 sm:p-5">
        <FormClientReleaseSchedule
          v-model:frequency="frequency"
          v-model:schedule="schedule"
          :articlesRemaining="articlesRemaining"
          :articleQuality="articleQuality"
          :nextReleaseAt="nextReleaseAt"
        />
      </div>

      <div class="flex items-center gap-3 border-t border-default px-4 py-4 sm:px-5">
        <UIcon name="mdi:playlist-plus" class="hidden size-5 shrink-0 text-muted sm:block" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <p class="text-sm font-semibold text-highlighted">{{ $t('common.preferences.aiSeries.title') }}</p>
            <UTooltip :text="$t('common.preferences.aiSeries.description')">
              <UButton
                icon="mdi:information-outline"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="$t('common.preferences.aiSeries.description')"
              />
            </UTooltip>
          </div>
          <p class="mt-0.5 text-sm leading-5 text-muted">{{ $t('common.preferences.aiSeries.summary') }}</p>
        </div>
        <USwitch
          :modelValue="aiSeriesEnabled"
          :aria-label="$t('common.preferences.aiSeries.title')"
          @update:modelValue="emit('update:aiSeriesEnabled', $event as boolean)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { ArticleQuality } from '~~/shared/utils/articleQuality'
import type { ReleaseFrequency, ReleaseScheduleSettings } from '~~/shared/utils/releaseSchedule'

defineProps<{
  autoRelease: boolean
  aiSeriesEnabled: boolean
  articlesRemaining?: number | null
  articleQuality?: ArticleQuality
  nextReleaseAt?: string | null
}>()
const emit = defineEmits<{
  'update:autoRelease': [boolean]
  'update:aiSeriesEnabled': [boolean]
}>()
const frequency = defineModel<ReleaseFrequency>('frequency', { required: true })
const schedule = defineModel<ReleaseScheduleSettings>('schedule', { required: true })
</script>
