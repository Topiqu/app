<template>
  <UAlert
    v-if="visible && data"
    :color="data.credits.atRolloverCap ? 'warning' : 'primary'"
    variant="subtle"
    icon="mdi:star-four-points-outline"
    :title="$t('articleBatch.nudge.title', { n: number.format(data.credits.free) }, data.credits.free)"
    :description="$t(data.credits.atRolloverCap ? 'articleBatch.nudge.capped' : 'articleBatch.nudge.description')"
    :actions="[
      {
        label: $t('articleBatch.nudge.action'),
        color: data.credits.atRolloverCap ? 'warning' : 'primary',
        variant: 'solid',
        to: localePath({ name: 'admin-credits' }),
      },
    ]"
    close
    @update:open="dismiss"
  />
</template>

<script setup lang="ts">
import type { BatchNudgeDismissal } from '~~/shared/utils/articleBatch'

const { locale } = useI18n()
const localePath = useLocalePath()
const can = useTenantScope()
const { data } = useArticleBatchOverview()
const number = computed(() => new Intl.NumberFormat(locale.value))
const month = new Date().toISOString().slice(0, 7)
// A cookie, not localStorage: the dashboard is server-rendered, and a dismissed nudge would flash until mount.
const dismissed = useCookie<BatchNudgeDismissal | null>('article-batch-nudge', {
  default: () => null,
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
})
const visible = computed(
  () =>
    can('ARTICLE_WRITE_OTHERS') &&
    data.value?.enabled === true &&
    !['PROPOSED', 'ACTIVE'].includes(data.value.batch?.status ?? '') &&
    showsBatchNudge(data.value.credits, data.value.clientSiteId, dismissed.value, month),
)

const dismiss = () => {
  if (!data.value) return
  dismissed.value = {
    site: data.value.clientSiteId,
    free: data.value.credits.free,
    capped: data.value.credits.atRolloverCap,
    month,
  }
}
</script>
