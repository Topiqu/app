<template>
  <!-- An inset shadow, not border-l: `divide-default` on the list recolours every border of a child. -->
  <li
    class="flex items-center gap-3 px-4 py-3"
    :class="{
      'opacity-60': cluster.status === 'SKIPPED',
      'bg-primary/5 shadow-[inset_3px_0_0_var(--ui-primary)]': cluster.status === 'PINNED',
    }"
  >
    <span v-if="position" class="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{{ position }}</span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1">
        <p class="truncate text-sm font-medium text-highlighted">{{ cluster.keyword }}</p>
        <UBadge v-if="cluster.status === 'PINNED'" size="sm" variant="soft" color="primary">
          {{ $t('common.keywordPlan.pinned') }}
        </UBadge>
        <UPopover v-if="cluster.reason">
          <UButton
            square
            size="xs"
            color="neutral"
            variant="ghost"
            icon="mdi:information-outline"
            class="-my-1"
            :aria-label="$t('common.keywordPlan.why')"
          />
          <template #content>
            <p class="max-w-72 p-3 text-sm">{{ cluster.reason }}</p>
          </template>
        </UPopover>
      </div>
      <p
        v-if="cluster.pillar || (showDifficulty && level)"
        class="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted"
      >
        <UBadge v-if="cluster.pillar" color="neutral" variant="soft" size="sm" class="min-w-0">
          <span class="truncate">{{ cluster.pillar }}</span>
        </UBadge>
        <span v-if="showDifficulty && level" class="flex shrink-0 items-center gap-1">
          <span class="size-1.5 rounded-full" :class="levelColor[level]" aria-hidden="true" />
          {{ $t(`common.keywordPlan.difficulty.${level}`) }}
        </span>
      </p>
    </div>
    <p class="w-24 shrink-0 text-right">
      <span class="block text-sm font-medium tabular-nums" :class="cluster.volume ? 'text-highlighted' : 'text-muted'">
        {{ cluster.volume ? `≈ ${volume}` : '—' }}
        <span class="sr-only">
          {{ $t(cluster.volume ? 'common.keywordPlan.volumeUnit' : 'common.keywordPlan.volumeUnknown') }}
        </span>
      </span>
      <span
        v-if="cluster.volume && maxVolume"
        class="mt-1 block h-1 overflow-hidden rounded-full bg-accented"
        aria-hidden="true"
      >
        <span
          class="ml-auto block h-full rounded-full bg-primary/70"
          :style="{ width: `${(cluster.volume / maxVolume) * 100}%` }"
        />
      </span>
    </p>
    <UTooltip v-if="cluster.status !== 'SKIPPED'" :text="pinLabel">
      <UButton
        square
        size="sm"
        :color="cluster.status === 'PINNED' ? 'primary' : 'neutral'"
        :variant="cluster.status === 'PINNED' ? 'soft' : 'ghost'"
        :icon="cluster.status === 'PINNED' ? 'mdi:pin' : 'mdi:pin-outline'"
        :aria-label="pinLabel"
        :aria-pressed="cluster.status === 'PINNED'"
        :disabled="busy"
        @click="emit('toggle', 'PINNED')"
      />
    </UTooltip>
    <UTooltip :text="skipLabel">
      <UButton
        square
        size="sm"
        color="neutral"
        variant="ghost"
        :icon="cluster.status === 'SKIPPED' ? 'mdi:restore' : 'mdi:close'"
        :aria-label="skipLabel"
        :disabled="busy"
        @click="emit('toggle', 'SKIPPED')"
      />
    </UTooltip>
  </li>
</template>

<script setup lang="ts">
import { difficultyLevel } from '~~/shared/utils/keywordPlan'

/** `position` is the queue order; skipped topics have none. */
const props = defineProps<{
  cluster: KeywordPlanCluster
  busy: boolean
  position?: number
  /** Largest volume in the plan; the bar is relative to it. */
  maxVolume: number
  showDifficulty: boolean
}>()
const emit = defineEmits<{ toggle: [target: Exclude<KeywordPlanStatus, 'OPEN'>] }>()

const { t, locale } = useI18n()

const pinLabel = computed(() =>
  t(props.cluster.status === 'PINNED' ? 'common.keywordPlan.unpin' : 'common.keywordPlan.pin', {
    keyword: props.cluster.keyword,
  }),
)
const skipLabel = computed(() =>
  t(props.cluster.status === 'SKIPPED' ? 'common.keywordPlan.restore' : 'common.keywordPlan.skip', {
    keyword: props.cluster.keyword,
  }),
)

const level = computed(() => difficultyLevel(props.cluster.difficulty))
const levelColor = { easy: 'bg-success', medium: 'bg-warning', hard: 'bg-error' } as const
const volume = computed(() => new Intl.NumberFormat(locale.value).format(props.cluster.volume))
</script>
