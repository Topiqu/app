<template>
  <UAlert
    v-if="visible"
    color="primary"
    variant="subtle"
    icon="mdi:star-four-points-outline"
    :title="$t('articleBatch.nudge.title', { n: data!.credits.free })"
    :description="$t('articleBatch.nudge.description')"
    :actions="[
      {
        label: $t('articleBatch.nudge.action'),
        color: 'primary',
        variant: 'solid',
        to: localePath({ name: 'admin-credits' }),
      },
    ]"
    close
    @update:open="dismissed = true"
  />
</template>

<script setup lang="ts">
// One article a week beyond the autopilot is not worth interrupting anyone for.
const MIN_FREE_CREDITS = 10

const localePath = useLocalePath()
const can = useTenantScope()
const { data } = useArticleBatchOverview()
// Per month, so a dismissal does not hide credits that keep piling up.
const dismissed = useLocalStorage(`article-batch-nudge:${new Date().toISOString().slice(0, 7)}`, false, {
  // The article list is server-rendered: reading storage during hydration would mismatch.
  initOnMounted: true,
})
const visible = computed(
  () =>
    !dismissed.value &&
    can('ARTICLE_WRITE_OTHERS') &&
    data.value?.enabled === true &&
    data.value.credits.free >= MIN_FREE_CREDITS &&
    !['PROPOSED', 'ACTIVE'].includes(data.value.batch?.status ?? ''),
)
</script>
