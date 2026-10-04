<template>
  <li class="flex items-center gap-3 px-4 py-3" :class="cluster.status === 'SKIPPED' && 'opacity-60'">
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
            :aria-label="$t('common.keywordPlan.why')"
          />
          <template #content>
            <p class="max-w-72 p-3 text-sm">{{ cluster.reason }}</p>
          </template>
        </UPopover>
      </div>
      <p class="text-xs text-muted">{{ details }}</p>
    </div>
    <UTooltip v-if="cluster.status !== 'SKIPPED'" :text="pinLabel">
      <UButton
        square
        size="sm"
        color="neutral"
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

const props = defineProps<{ cluster: KeywordPlanCluster; busy: boolean }>()
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

const details = computed(() => {
  const level = difficultyLevel(props.cluster.difficulty)
  return [
    props.cluster.pillar,
    props.cluster.volume
      ? t('common.keywordPlan.volume', { count: new Intl.NumberFormat(locale.value).format(props.cluster.volume) })
      : t('common.keywordPlan.volumeUnknown'),
    level ? t(`common.keywordPlan.difficulty.${level}`) : null,
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>
