<template>
  <section data-article-optimization>
    <UCollapsible v-model:open="open">
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        type="button"
        class="w-full"
        :ui="{ trailingIcon: 'ms-auto' }"
        icon="mdi:gauge"
        :trailingIcon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :label="$t('articles.editor.optimization.title')"
      />
      <template #content>
        <div class="mt-3 rounded-lg border border-default bg-elevated/30 p-4" aria-live="polite">
          <div v-if="state === 'loading' || (state === 'analyzing' && !result)" class="space-y-2 text-sm text-muted">
            <span>{{ $t('articles.editor.optimization.analyzing') }}</span>
            <UProgress :aria-label="$t('articles.editor.optimization.analyzing')" />
          </div>
          <UAlert
            v-else-if="state === 'empty'"
            color="neutral"
            variant="soft"
            icon="mdi:text-box-edit-outline"
            :title="$t('articles.editor.optimization.emptyTitle')"
            :description="$t('articles.editor.optimization.emptyDescription')"
          />
          <UAlert
            v-else-if="state === 'error'"
            color="error"
            variant="soft"
            icon="mdi:alert-circle-outline"
            :title="$t('articles.editor.optimization.errorTitle')"
            :description="$t('articles.editor.optimization.errorDescription')"
          >
            <template #actions
              ><UButton size="sm" color="error" variant="soft" @click="$emit('retry')">{{
                $t('articles.editor.optimization.retry')
              }}</UButton></template
            >
          </UAlert>
          <template v-else-if="result">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-muted">
                  {{ $t('articles.editor.optimization.score') }}
                </p>
                <p class="text-3xl font-bold tabular-nums text-highlighted">
                  {{ result.overallScore }}<span class="text-base text-muted">/100</span>
                </p>
              </div>
              <UBadge v-if="state === 'stale' || state === 'analyzing'" color="warning" variant="soft">
                <UIcon name="mdi:sync" class="mr-1 size-3.5" />
                {{ $t(`articles.editor.optimization.${state}`) }}
              </UBadge>
            </div>
            <UProgress :modelValue="result.overallScore" color="primary" class="mt-3" />
            <div class="mt-4 grid grid-cols-2 gap-2">
              <div v-for="category in result.categories" :key="category.category" class="rounded-md bg-default p-2">
                <div class="flex justify-between gap-2 text-xs">
                  <span class="text-muted">{{
                    $t(`articles.editor.optimization.categories.${category.category}`)
                  }}</span
                  ><strong class="tabular-nums text-highlighted">{{ category.score ?? '—' }}</strong>
                </div>
                <p v-if="category.status === 'insufficient-data'" class="mt-1.5 text-[11px] text-muted">
                  {{ $t('articles.editor.optimization.insufficientData') }}
                </p>
                <UProgress v-else :modelValue="category.score ?? 0" size="xs" class="mt-1.5" />
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2 text-xs">
              <UBadge color="error" variant="soft">{{
                $t('articles.editor.optimization.counts.issues', { count: result.counts.issues })
              }}</UBadge>
              <UBadge color="warning" variant="soft">{{
                $t('articles.editor.optimization.counts.recommendations', { count: result.counts.recommendations })
              }}</UBadge>
              <UBadge color="success" variant="soft">{{
                $t('articles.editor.optimization.counts.passed', { count: result.counts.passed })
              }}</UBadge>
            </div>
            <ul v-if="issues.length" class="mt-4 flex flex-col gap-2">
              <li v-for="item in issues" :key="item.id" class="rounded-md border border-default bg-default p-3">
                <div class="flex items-start gap-2">
                  <UIcon
                    :name="item.status === 'error' ? 'mdi:alert-circle-outline' : 'mdi:lightbulb-outline'"
                    class="mt-0.5 size-4 shrink-0"
                    :class="item.status === 'error' ? 'text-error' : 'text-warning'"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-highlighted">
                      {{ $t(`articles.editor.optimization.checks.${item.id}.title`) }}
                    </p>
                    <p class="mt-0.5 text-xs leading-5 text-muted">
                      {{ $t(`articles.editor.optimization.checks.${item.id}.description`) }}
                    </p>
                  </div>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="mdi:arrow-right"
                    :aria-label="$t('articles.editor.optimization.goTo')"
                    @click="$emit('navigate', item.target)"
                  />
                </div>
              </li>
            </ul>
            <UCollapsible v-if="passed.length" v-model:open="passedOpen" class="mt-4">
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
              <template #content
                ><ul class="mt-2 space-y-1">
                  <li v-for="item in passed" :key="item.id" class="flex gap-2 text-xs text-muted">
                    <UIcon name="mdi:check" class="mt-0.5 size-3.5 shrink-0 text-success" />{{
                      $t(`articles.editor.optimization.checks.${item.id}.title`)
                    }}
                  </li>
                </ul></template
              >
            </UCollapsible>
          </template>
        </div>
      </template>
    </UCollapsible>
  </section>
</template>

<script setup lang="ts">
import type { ArticleOptimizationResult, OptimizationTarget } from '~~/shared/types/articleOptimization'

import type { ArticleOptimizationState } from '~/composables/useArticleOptimization'

const props = defineProps<{ state: ArticleOptimizationState; result: ArticleOptimizationResult | null }>()
defineEmits<{ retry: []; navigate: [target: OptimizationTarget] }>()
const open = shallowRef(true)
const passedOpen = shallowRef(false)
const issues = computed(() =>
  (props.result?.checks ?? [])
    .filter((item) => item.status === 'error' || item.status === 'warning')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'error' ? -1 : 1)),
)
const passed = computed(() => (props.result?.checks ?? []).filter((item) => item.status === 'passed'))
</script>
