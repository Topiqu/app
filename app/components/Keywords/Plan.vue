<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div>
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('common.keywordPlan.title') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ $t('common.keywordPlan.description') }}</p>
    </div>

    <p
      v-if="!queued.length"
      class="flex items-center gap-2 rounded-(--topiqu-surface-radius) border border-dashed border-default px-4 py-3 text-sm text-muted"
    >
      <UIcon name="mdi:playlist-clock" class="size-4 shrink-0" aria-hidden="true" />
      {{ $t('common.keywordPlan.empty') }}
    </p>
    <ul
      v-else
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <KeywordsPlanItem
        v-for="(cluster, index) in queued"
        :key="cluster.id"
        :cluster
        :position="index + 1"
        :busy="busy === cluster.id"
        @toggle="toggle(cluster, $event)"
      />
    </ul>

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
          :busy="busy === cluster.id"
          @toggle="toggle(cluster, $event)"
        />
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const headingId = useId()
const busy = shallowRef<string | null>(null)
const showSkipped = shallowRef(false)

const { data, refetch } = useKeywordPlan()
const queued = computed(() => (data.value?.clusters ?? []).filter((cluster) => cluster.status !== 'SKIPPED'))
const skipped = computed(() => (data.value?.clusters ?? []).filter((cluster) => cluster.status === 'SKIPPED'))

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
