<template>
  <li class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge size="sm" variant="soft" :color="action.type === 'REFRESH' ? 'info' : 'primary'">
          {{ $t(`common.contentActions.type.${action.type}`) }}
        </UBadge>
        <p class="truncate text-sm font-medium text-highlighted">{{ action.article.title }}</p>
      </div>
      <p class="mt-1 text-xs text-muted">
        {{ $t('common.contentActions.keyword', { keyword: action.keyword }) }}
      </p>
      <p class="mt-1 text-sm text-default">{{ reason }}</p>

      <ul v-if="action.status === 'READY' && action.proposal" class="mt-2 list-disc space-y-0.5 pl-5 text-sm">
        <li v-for="line in action.proposal.summary" :key="line">{{ line }}</li>
      </ul>
      <p v-if="action.status === 'READY' && action.proposal" class="mt-1 text-xs text-muted">
        {{ $t('common.contentActions.changed', { percent: action.proposal.changed }) }}
      </p>
      <p v-if="action.status === 'QUEUED'" class="mt-2 flex items-center gap-2 text-xs text-muted">
        <UIcon name="mdi:loading" class="size-4 animate-spin" aria-hidden="true" />
        {{ $t('common.contentActions.preparing') }}
      </p>
      <p v-if="action.status === 'FAILED'" class="mt-2 text-xs text-error">
        {{ $t('common.contentActions.prepareFailed') }}
      </p>
      <p v-if="action.status === 'APPLIED'" class="mt-2 text-xs text-muted">{{ result }}</p>
    </div>

    <div class="flex shrink-0 flex-wrap gap-2">
      <template v-if="action.status === 'SUGGESTED' || action.status === 'FAILED'">
        <UButton
          v-if="allowed"
          size="sm"
          icon="mdi:auto-fix"
          :loading="busy"
          :label="action.status === 'FAILED' ? $t('common.contentActions.retry') : $t('common.contentActions.prepare')"
          @click="emit('run', 'prepare')"
        />
        <UButton
          v-else
          size="sm"
          color="neutral"
          variant="soft"
          icon="mdi:star-four-points"
          :to="localePath({ name: 'settings', query: { tab: 'billing' } })"
          :label="$t('common.contentActions.upgrade')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          :label="$t('common.contentActions.dismiss')"
          @click="emit('run', 'dismiss')"
        />
      </template>
      <template v-else-if="action.status === 'READY'">
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          icon="mdi:eye-outline"
          :label="$t('common.contentActions.preview')"
          @click="previewOpen = true"
        />
        <UButton
          size="sm"
          icon="mdi:check"
          :loading="busy"
          :label="$t('common.contentActions.apply')"
          @click="emit('run', 'apply')"
        />
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          :label="$t('common.contentActions.discard')"
          @click="emit('run', 'dismiss')"
        />
      </template>
      <UButton
        v-else-if="action.status === 'APPLIED'"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="mdi:undo"
        :loading="busy"
        :label="$t('common.contentActions.rollback')"
        @click="emit('run', 'rollback')"
      />
    </div>

    <UModal
      v-if="action.proposal"
      v-model:open="previewOpen"
      :title="action.proposal.title"
      :description="action.proposal.excerpt ?? undefined"
      :ui="{ content: 'max-w-3xl', body: 'min-h-0 overflow-y-auto' }"
    >
      <template #body>
        <!-- eslint-disable-next-line vue/no-v-html -- server-sanitised proposal (`sanitizeHtml` in applySectionEdits) -->
        <div class="article-content" :class="ARTICLE_PROSE_CLASS" v-html="action.proposal.content" />
      </template>
    </UModal>
  </li>
</template>

<script setup lang="ts">
import { ARTICLE_PROSE_CLASS } from '~~/shared/utils/articleProse'

const props = defineProps<{ action: ContentActionView; allowed: boolean; busy: boolean }>()
const emit = defineEmits<{ run: [command: ContentActionCommand] }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
const previewOpen = shallowRef(false)

const reason = computed(() =>
  props.action.type === 'REFRESH'
    ? t('common.contentActions.reasonRefresh', { position: props.action.positionBefore ?? '?' })
    : (props.action.reason ?? props.action.angle ?? ''),
)

/** "14. → 7. místo" once measured, otherwise when it will be. */
const result = computed(() => {
  const { positionBefore, positionAfter, measuredAt, appliedAt } = props.action
  if (!measuredAt) {
    const due = appliedAt ? new Date(new Date(appliedAt).getTime() + 30 * 86_400_000) : null
    return t('common.contentActions.measuring', {
      date: due ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(due) : '',
    })
  }
  const after = positionAfter == null ? t('common.keywordResults.notRanked') : `${positionAfter}.`
  return positionBefore == null
    ? t('common.contentActions.resultAfter', { after })
    : t('common.contentActions.result', { before: positionBefore, after })
})
</script>
