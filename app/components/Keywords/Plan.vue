<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div class="flex items-center gap-1">
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('common.keywordPlan.title') }}</h2>
      <UPopover :content="{ align: 'start' }">
        <UButton
          square
          size="xs"
          color="neutral"
          variant="ghost"
          icon="mdi:information-outline"
          :aria-label="$t('common.statHint', { label: $t('common.keywordPlan.title') })"
        />
        <template #content>
          <p class="max-w-72 p-3 text-sm leading-6">{{ $t('common.keywordPlan.description') }}</p>
        </template>
      </UPopover>
    </div>

    <p
      v-if="!queued.length"
      class="flex items-center gap-2 rounded-(--topiqu-surface-radius) border border-dashed border-default px-4 py-3 text-sm text-muted"
    >
      <UIcon name="mdi:playlist-clock" class="size-4 shrink-0" aria-hidden="true" />
      {{ $t('common.keywordPlan.empty') }}
    </p>
    <div v-else class="overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default">
      <div
        class="flex items-center gap-3 border-b border-default bg-elevated/40 px-4 py-2 text-xs font-medium text-muted"
        aria-hidden="true"
      >
        <span class="w-5 shrink-0" />
        <span class="flex-1">{{ $t('common.keywordPlan.topic') }}</span>
        <span class="w-24 shrink-0 text-right">{{ $t('common.keywordPlan.volumeUnit') }}</span>
        <span class="w-[4.5rem] shrink-0" />
      </div>
      <ul class="divide-y divide-default">
        <KeywordsPlanItem
          v-for="(cluster, index) in visible"
          :key="cluster.id"
          :cluster
          :position="index + 1"
          :maxVolume
          :showDifficulty
          :busy="busy === cluster.id"
          @toggle="toggle(cluster, $event)"
        />
      </ul>
      <div v-if="queued.length > PREVIEW" class="border-t border-default px-4 py-2">
        <UButton
          size="sm"
          color="neutral"
          variant="link"
          :trailingIcon="showAll ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          :aria-expanded="showAll"
          @click="showAll = !showAll"
        >
          {{ showAll ? $t('common.actions.showLess') : $t('common.keywordPlan.showAll', { count: queued.length }) }}
        </UButton>
      </div>
    </div>

    <template v-if="skipped.length">
      <UButton
        color="neutral"
        variant="link"
        size="sm"
        :ui="{ base: 'self-start p-0' }"
        :icon="showSkipped ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :aria-expanded="showSkipped"
        @click="showSkipped = !showSkipped"
      >
        {{ $t('common.keywordPlan.skipped', { count: skipped.length }) }}
      </UButton>
      <ul
        v-if="showSkipped"
        class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
      >
        <KeywordsPlanItem
          v-for="cluster in skipped"
          :key="cluster.id"
          :cluster
          :maxVolume
          :showDifficulty
          :busy="busy === cluster.id"
          @toggle="toggle(cluster, $event)"
        />
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { difficultyLevel } from '~~/shared/utils/keywordPlan'

const PREVIEW = 5

const { t } = useI18n()
const toast = useToast()
const headingId = useId()
const busy = shallowRef<string | null>(null)
const showSkipped = shallowRef(false)
const showAll = shallowRef(false)

const { data, refetch } = useKeywordPlan()
const queued = computed(() => (data.value?.clusters ?? []).filter((cluster) => cluster.status !== 'SKIPPED'))
const skipped = computed(() => (data.value?.clusters ?? []).filter((cluster) => cluster.status === 'SKIPPED'))
const visible = computed(() => (showAll.value ? queued.value : queued.value.slice(0, PREVIEW)))
const maxVolume = computed(() => Math.max(0, ...(data.value?.clusters ?? []).map((cluster) => cluster.volume)))
// A label every row repeats tells nothing; it only shows once topics actually differ.
const showDifficulty = computed(
  () => new Set((data.value?.clusters ?? []).map((cluster) => difficultyLevel(cluster.difficulty))).size > 1,
)

/** Clicking the active state again returns the keyword to the plan. */
const toggle = async (cluster: KeywordPlanCluster, target: Exclude<KeywordPlanStatus, 'OPEN'>) => {
  busy.value = cluster.id
  try {
    await $fetch(`/api/keyword-plan/${cluster.id}`, {
      method: 'PATCH',
      body: { status: cluster.status === target ? 'OPEN' : target },
    })
    await refetch()
  } catch (error) {
    toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.keywordPlan.failed')) })
  } finally {
    busy.value = null
  }
}
</script>
