<template>
  <UModal
    v-model:open="open"
    :title="$t('widgets.library.title')"
    :description="$t('widgets.library.description')"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <UTabs v-model="category" :items="categoryItems" :content="false" variant="link" size="sm" class="mb-5" />
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="preset in visible"
          :key="preset.id"
          class="group relative flex flex-col overflow-hidden rounded-xl border border-default bg-default transition has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-primary"
          :class="isLocked(preset.kind) ? 'opacity-75' : 'hover:border-accented hover:shadow-md'"
        >
          <FormClientWidgetThumb class="transition-colors group-hover:bg-accented/60">
            <FormClientWidgetPreview :widget="preset.sample" sample />
          </FormClientWidgetThumb>
          <div class="flex flex-1 items-start gap-3 border-t border-default p-3">
            <UIcon :name="preset.icon" class="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
            <div class="min-w-0">
              <p class="font-medium text-highlighted">{{ $t(`widgets.presets.${preset.id}.name`) }}</p>
              <p
                :id="`${hintId}-${preset.id}`"
                class="text-xs"
                :class="isLocked(preset.kind) ? 'text-warning' : 'text-muted'"
              >
                {{ isLocked(preset.kind) ? $t(lockReason(preset.kind)) : $t(`widgets.presets.${preset.id}.hint`) }}
              </p>
            </div>
          </div>
          <span
            v-if="isLocked(preset.kind)"
            class="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-inverted text-inverted"
            aria-hidden="true"
          >
            <UIcon name="mdi:lock-outline" class="size-4" />
          </span>
          <!-- Covers the tile: the preview inside holds headings and links, which a button may not contain. -->
          <button
            type="button"
            class="absolute inset-0 cursor-pointer rounded-xl outline-none disabled:cursor-not-allowed"
            :disabled="isLocked(preset.kind)"
            :aria-label="$t(`widgets.presets.${preset.id}.name`)"
            :aria-describedby="`${hintId}-${preset.id}`"
            @click="pick(preset.id)"
          />
        </li>
      </ul>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { WidgetInput, WidgetKind } from '~~/shared/utils/widgets'

import { LIBRARY_CATEGORIES, WIDGET_PRESETS, type LibraryCategory } from '~/utils/widgetPresets'

const { allowed, currency } = defineProps<{ allowed: WidgetKind[]; currency: string }>()
const emit = defineEmits<{ pick: [presetId: string] }>()
const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const hintId = useId()
const category = shallowRef<LibraryCategory | 'all'>('all')

const categoryItems = computed(() =>
  (['all', ...Object.keys(LIBRARY_CATEGORIES)] as const).map((value) => ({
    value,
    label: t(`widgets.library.categories.${value}`),
  })),
)

const presets = computed(() =>
  WIDGET_PRESETS.map((preset) => ({
    ...preset,
    sample: {
      kind: preset.kind,
      slot: preset.slot,
      active: true,
      languages: [],
      config: preset.config({ t, currency }),
    } as WidgetInput,
  })),
)
const visible = computed(() =>
  category.value === 'all'
    ? presets.value
    : presets.value.filter((preset) =>
        (LIBRARY_CATEGORIES[category.value as LibraryCategory] as readonly WidgetKind[]).includes(preset.kind),
      ),
)

const isLocked = (kind: WidgetKind) => !allowed.includes(kind)
const lockReason = (kind: WidgetKind) =>
  kind === 'HTML' && allowed.includes('CTA') ? 'widgets.locked.domain' : 'widgets.locked.plan'

function pick(id: string) {
  emit('pick', id)
  open.value = false
}
</script>
