<template>
  <section data-article-optimization>
    <UCollapsible v-model:open="open">
      <UButton
        color="neutral"
        variant="ghost"
        type="button"
        class="group w-full"
        :ui="{ trailingIcon: 'ms-auto' }"
        icon="mdi:gauge"
        :trailingIcon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
      >
        <span class="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
          <span class="font-semibold text-highlighted">{{ $t('articles.editor.optimization.title') }}</span>
          <span v-if="result" class="text-sm font-semibold tabular-nums" :class="scoreTextClass(result.overallScore)">
            {{ result.overallScore }}/100
          </span>
        </span>
      </UButton>

      <template #content>
        <div class="mt-2 border-l-2 border-primary/35 pl-4" aria-live="polite">
          <div
            v-if="state === 'loading' || (state === 'analyzing' && !result)"
            class="space-y-2 py-3 text-sm text-muted"
          >
            <span>{{ $t('articles.editor.optimization.analyzing') }}</span>
            <UProgress :aria-label="$t('articles.editor.optimization.analyzing')" />
          </div>

          <UAlert
            v-else-if="state === 'empty'"
            color="neutral"
            variant="subtle"
            icon="mdi:text-box-edit-outline"
            :title="$t('articles.editor.optimization.emptyTitle')"
            :description="$t('articles.editor.optimization.emptyDescription')"
          />

          <UAlert
            v-else-if="state === 'error'"
            color="error"
            variant="subtle"
            icon="mdi:alert-circle-outline"
            :title="$t('articles.editor.optimization.errorTitle')"
            :description="$t('articles.editor.optimization.errorDescription')"
          >
            <template #actions>
              <UButton size="sm" color="error" variant="soft" @click="$emit('retry')">
                {{ $t('articles.editor.optimization.retry') }}
              </UButton>
            </template>
          </UAlert>

          <template v-else-if="result">
            <div class="flex items-end justify-between gap-4 pb-4 pt-2">
              <div>
                <p class="text-xs font-medium text-muted">{{ $t('articles.editor.optimization.score') }}</p>
                <div class="mt-1 flex items-baseline gap-2">
                  <p class="text-4xl font-semibold tracking-tight tabular-nums text-highlighted">
                    {{ result.overallScore }}<span class="text-base font-medium text-muted">/100</span>
                  </p>
                  <span class="text-xs font-medium" :class="scoreTextClass(result.overallScore)">
                    {{ $t(`articles.editor.optimization.scoreBands.${scoreBand(result.overallScore)}`) }}
                  </span>
                </div>
              </div>
              <span
                v-if="state === 'stale' || state === 'analyzing'"
                class="inline-flex items-center gap-1 text-xs text-warning"
              >
                <UIcon name="mdi:sync" class="size-3.5" />
                {{ $t(`articles.editor.optimization.${state}`) }}
              </span>
            </div>

            <UProgress
              :modelValue="result.overallScore"
              :color="scoreColor(result.overallScore)"
              size="sm"
              :aria-label="$t('articles.editor.optimization.score')"
            />

            <dl class="mt-5 divide-y divide-default border-y border-default">
              <div v-for="category in result.categories" :key="category.category" class="py-3">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <dt class="text-sm font-medium text-highlighted">
                      {{ $t(`articles.editor.optimization.categories.${category.category}`) }}
                    </dt>
                    <dd class="mt-0.5 text-xs leading-5 text-muted">
                      {{ $t(`articles.editor.optimization.categoryDescriptions.${category.category}`) }}
                    </dd>
                  </div>
                  <span
                    v-if="category.status === 'evaluated'"
                    class="shrink-0 text-sm font-semibold tabular-nums"
                    :class="scoreTextClass(category.score ?? 0)"
                  >
                    {{ category.score }}
                  </span>
                  <span v-else class="shrink-0 text-xs text-muted">—</span>
                </div>
                <p v-if="category.status === 'insufficient-data'" class="mt-1.5 text-[11px] text-muted">
                  {{ $t('articles.editor.optimization.insufficientData') }}
                </p>
                <UProgress
                  v-else
                  :modelValue="category.score ?? 0"
                  :color="scoreColor(category.score ?? 0)"
                  size="xs"
                  class="mt-2"
                />
              </div>
            </dl>

            <details class="group border-b border-default py-3">
              <summary
                class="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <UIcon name="mdi:information-outline" class="size-4" />
                {{ $t('articles.editor.optimization.methodologyTitle') }}
                <UIcon name="mdi:chevron-down" class="ml-auto size-4 transition-transform group-open:rotate-180" />
              </summary>
              <p class="mt-2 pr-5 text-xs leading-5 text-muted">
                {{ $t('articles.editor.optimization.methodologyDescription') }}
              </p>
              <p class="mt-1 pr-5 text-xs leading-5 text-muted">
                {{ $t('articles.editor.optimization.methodologySeoCaps') }}
              </p>
            </details>

            <p class="mt-4 text-xs text-muted">
              <span v-if="result.counts.issues" class="font-semibold text-error">
                {{ $t('articles.editor.optimization.counts.issues', { count: result.counts.issues }) }}
              </span>
              <span v-if="result.counts.issues && result.counts.recommendations" aria-hidden="true"> · </span>
              <span v-if="result.counts.recommendations" class="font-semibold text-warning">
                {{
                  $t('articles.editor.optimization.counts.recommendations', { count: result.counts.recommendations })
                }}
              </span>
              <span
                v-if="(result.counts.issues || result.counts.recommendations) && result.counts.passed"
                aria-hidden="true"
              >
                ·
              </span>
              <span v-if="result.counts.passed" class="font-medium text-success">
                {{ $t('articles.editor.optimization.counts.passed', { count: result.counts.passed }) }}
              </span>
            </p>

            <div v-if="issues.length" class="mt-4">
              <h4 class="text-sm font-semibold text-highlighted">
                {{ $t('articles.editor.optimization.attentionTitle') }}
              </h4>
              <ul class="mt-1 divide-y divide-default">
                <li v-for="item in issues" :key="item.id" class="py-3">
                  <div class="flex items-start gap-3">
                    <UIcon
                      :name="item.status === 'error' ? 'mdi:alert-circle-outline' : 'mdi:lightbulb-outline'"
                      class="mt-0.5 size-4 shrink-0"
                      :class="item.status === 'error' ? 'text-error' : 'text-warning'"
                    />
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-[11px] font-semibold uppercase tracking-wide"
                        :class="item.status === 'error' ? 'text-error' : 'text-warning'"
                      >
                        {{ $t(`articles.editor.optimization.statusLabels.${item.status}`) }}
                      </p>
                      <p class="mt-0.5 text-sm font-medium text-highlighted">
                        {{ $t(`articles.editor.optimization.checks.${item.id}.title`) }}
                      </p>
                      <p class="mt-1 text-xs leading-5 text-muted">
                        {{ $t(`articles.editor.optimization.checks.${item.id}.description`, item.meta ?? {}) }}
                      </p>
                      <p
                        v-if="diagnostic(item)"
                        class="mt-1.5 truncate rounded-md bg-elevated px-2 py-1 font-mono text-[11px] text-highlighted"
                        :title="diagnostic(item)"
                      >
                        {{ diagnostic(item) }}
                      </p>
                      <p class="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-toned">
                        <UIcon name="mdi:tools" class="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>
                          <strong class="font-medium text-highlighted"
                            >{{ $t('articles.editor.optimization.howToFix') }}:</strong
                          >
                          {{ $t(`articles.editor.optimization.checks.${item.id}.recommendation`) }}
                        </span>
                      </p>
                    </div>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="mdi:arrow-right"
                      :aria-label="
                        $t('articles.editor.optimization.goToCheck', {
                          check: $t(`articles.editor.optimization.checks.${item.id}.title`),
                        })
                      "
                      @click="$emit('navigate', item.target)"
                    />
                  </div>
                </li>
              </ul>
            </div>

            <UCollapsible v-if="passed.length" v-model:open="passedOpen" class="mt-2">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                class="w-full"
                :ui="{ trailingIcon: 'ms-auto' }"
                icon="mdi:check-circle-outline"
                :trailingIcon="passedOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                :label="$t('articles.editor.optimization.passedChecks', { count: passed.length })"
              />
              <template #content>
                <ul class="mt-1 divide-y divide-default border-t border-default">
                  <li v-for="item in passed" :key="item.id" class="flex gap-2 py-2 text-xs text-muted">
                    <UIcon name="mdi:check" class="mt-0.5 size-3.5 shrink-0 text-success" />
                    {{ $t(`articles.editor.optimization.checks.${item.id}.title`) }}
                  </li>
                </ul>
              </template>
            </UCollapsible>
          </template>
        </div>
      </template>
    </UCollapsible>
  </section>
</template>

<script setup lang="ts">
import type {
  ArticleOptimizationResult,
  OptimizationCheck,
  OptimizationTarget,
} from '~~/shared/types/articleOptimization'

import type { ArticleOptimizationState } from '~/composables/useArticleOptimization'

const props = defineProps<{ state: ArticleOptimizationState; result: ArticleOptimizationResult | null }>()
defineEmits<{ retry: []; navigate: [target: OptimizationTarget] }>()
const { t } = useI18n()

const open = shallowRef(true)
const passedOpen = shallowRef(false)
const issues = computed(() =>
  (props.result?.checks ?? [])
    .filter((item) => item.status === 'error' || item.status === 'warning')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'error' ? -1 : 1)),
)
const passed = computed(() => (props.result?.checks ?? []).filter((item) => item.status === 'passed'))

const diagnostic = (item: OptimizationCheck) => {
  if (item.id === 'sources-valid' && item.details?.itemNumber && item.details.value)
    return t('articles.editor.optimization.checks.sources-valid.diagnostic', {
      number: item.details.itemNumber,
      value: item.details.value,
    })
  if (item.target.kind === 'content' && item.target.blockIndex !== undefined)
    return t('articles.editor.optimization.contentBlockDiagnostic', { number: item.target.blockIndex + 1 })
  return ''
}

const scoreBand = (score: number) => (score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 50 ? 'fair' : 'poor')
const scoreColor = (score: number) => (score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error')
const scoreTextClass = (score: number) => (score >= 75 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-error')
</script>
