<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div>
      <h2 :id="headingId" class="text-base font-semibold text-highlighted">{{ $t('common.keywordResults.title') }}</h2>
      <p class="mt-1 text-sm text-muted">{{ $t('common.keywordResults.description') }}</p>
    </div>

    <p
      v-if="!results.length"
      class="rounded-(--topiqu-surface-radius) border border-dashed border-default px-4 py-3 text-sm text-muted"
    >
      {{ $t('common.keywordResults.empty') }}
    </p>
    <ul
      v-else
      class="divide-y divide-default overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default"
    >
      <li v-for="result in results" :key="result.id" class="flex items-center gap-3 px-4 py-3">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-highlighted">{{ result.keyword }}</p>
          <a
            v-if="result.url"
            :href="result.url"
            target="_blank"
            rel="noopener noreferrer"
            class="block truncate text-xs text-muted hover:underline"
          >
            {{ result.article?.title ?? result.url }}
          </a>
          <p v-else-if="result.article" class="truncate text-xs text-muted">{{ result.article.title }}</p>
        </div>
        <span v-if="change(result)" class="text-xs tabular-nums" :class="change(result)!.className">
          {{ change(result)!.label }}
        </span>
        <UBadge
          :color="result.position != null && result.position <= 10 ? 'success' : 'neutral'"
          variant="soft"
          class="tabular-nums"
        >
          {{
            result.position == null
              ? $t('common.keywordResults.notRanked')
              : $t('common.keywordResults.position', { position: result.position })
          }}
        </UBadge>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const { t } = useI18n()
const headingId = useId()

const { data } = useKeywordPlan()
const results = computed(() => data.value?.results ?? [])

/** Movement since the first reading; nothing while there is only one. */
const change = (result: KeywordPlanResult) => {
  if (result.position == null) return null
  if (result.firstPosition == null) return { label: t('common.keywordResults.entered'), className: 'text-success' }
  const gain = result.firstPosition - result.position
  if (!gain) return null
  return gain > 0
    ? { label: `↑ ${gain}`, className: 'text-success' }
    : { label: `↓ ${Math.abs(gain)}`, className: 'text-error' }
}
</script>
