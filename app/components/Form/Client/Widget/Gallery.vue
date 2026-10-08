<template>
  <UModal v-model:open="open" :title="$t('widgets.gallery.title')" :description="$t('widgets.gallery.description')">
    <template #body>
      <ul class="grid gap-2 sm:grid-cols-2">
        <li v-for="preset in WIDGET_PRESETS" :key="preset.id">
          <UButton
            color="neutral"
            variant="outline"
            block
            :disabled="!allowed.includes(preset.kind)"
            :ui="{ base: 'items-start justify-start gap-3 p-3 text-left' }"
            @click="pick(preset.id)"
          >
            <UIcon :name="preset.icon" class="mt-0.5 size-5 shrink-0 text-muted" />
            <span class="min-w-0">
              <span class="block font-medium text-highlighted">{{ $t(`widgets.presets.${preset.id}.name`) }}</span>
              <span class="block text-xs text-muted">
                {{ allowed.includes(preset.kind) ? $t(`widgets.presets.${preset.id}.hint`) : $t(lockReason(preset.kind)) }}
              </span>
            </span>
          </UButton>
        </li>
      </ul>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { WidgetKind } from '~~/shared/utils/widgets'

import { WIDGET_PRESETS } from '~/utils/widgetPresets'

const { allowed } = defineProps<{ allowed: WidgetKind[] }>()
const emit = defineEmits<{ pick: [presetId: string] }>()
const open = defineModel<boolean>('open', { default: false })

const lockReason = (kind: WidgetKind) =>
  kind === 'HTML' && allowed.includes('CTA') ? 'widgets.locked.domain' : 'widgets.locked.plan'

function pick(id: string) {
  emit('pick', id)
  open.value = false
}
</script>
