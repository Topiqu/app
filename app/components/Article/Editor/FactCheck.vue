<template>
  <section data-article-fact-check>
    <UCollapsible v-model:open="open">
      <UButton
        color="neutral"
        variant="soft"
        size="lg"
        type="button"
        class="w-full"
        :ui="{ trailingIcon: 'ms-auto' }"
        icon="mdi:shield-search"
        :trailingIcon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        :label="$t('articles.editor.factCheck.title')"
      />
      <template #content>
        <div class="mt-3 rounded-lg border border-default bg-elevated/30 p-4">
          <p class="text-xs leading-5 text-muted">{{ $t('articles.editor.factCheck.description') }}</p>

          <div v-if="state === 'running'" class="mt-4 space-y-2" aria-live="polite">
            <p class="text-sm text-muted">{{ $t('articles.editor.factCheck.running') }}</p>
            <UProgress :aria-label="$t('articles.editor.factCheck.running')" />
          </div>

          <UAlert
            v-else-if="state === 'error'"
            class="mt-4"
            color="error"
            variant="soft"
            icon="mdi:alert-circle-outline"
            :title="$t('articles.editor.factCheck.errorTitle')"
            :description="$t(`articles.editor.factCheck.error.${errorKind}`)"
          />

          <template v-if="result && state !== 'running'">
            <div class="mt-4 flex items-start justify-between gap-3">
              <div>
                <p class="text-2xl font-bold tabular-nums text-highlighted">{{ result.counts.total }}</p>
                <p class="text-xs text-muted">{{ $t('articles.editor.factCheck.claimsFound') }}</p>
              </div>
              <UBadge v-if="state === 'stale'" color="warning" variant="soft">
                {{ $t('articles.editor.factCheck.stale') }}
              </UBadge>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div class="rounded-md bg-default p-2">
                <span class="text-muted">{{ $t('articles.editor.factCheck.supported') }}</span>
                <strong class="float-right tabular-nums text-success">{{ result.counts.supported }}</strong>
              </div>
              <div class="rounded-md bg-default p-2">
                <span class="text-muted">{{ $t('articles.editor.factCheck.problematic') }}</span>
                <strong class="float-right tabular-nums text-error">{{ result.counts.problematic }}</strong>
              </div>
            </div>

            <UAlert
              v-if="!result.claims.length"
              class="mt-4"
              color="neutral"
              variant="soft"
              icon="mdi:information-outline"
              :title="$t('articles.editor.factCheck.noClaimsTitle')"
              :description="$t('articles.editor.factCheck.noClaimsDescription')"
            />

            <div v-if="sourceIssues.length" class="mt-4">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {{ $t('articles.editor.factCheck.sourceIssues') }}
              </p>
              <ul class="space-y-2">
                <li
                  v-for="source in sourceIssues"
                  :key="source.index"
                  class="rounded-md border border-warning/30 bg-warning/5 p-2.5"
                >
                  <div class="flex min-w-0 items-start gap-2">
                    <UIcon name="mdi:link-variant-off" class="mt-0.5 size-4 shrink-0 text-warning" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-xs font-medium text-highlighted">{{ source.url }}</p>
                      <p class="mt-0.5 text-xs text-muted">
                        {{ $t(`articles.editor.factCheck.sourceStatus.${source.status}`) }}
                      </p>
                    </div>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      icon="mdi:arrow-right"
                      :aria-label="$t('articles.editor.optimization.goTo')"
                      @click="$emit('navigateSources')"
                    />
                  </div>
                </li>
              </ul>
            </div>

            <ul v-if="reviewClaims.length" class="mt-4 space-y-3">
              <li v-for="claim in reviewClaims" :key="claim.id" class="rounded-md border border-default bg-default p-3">
                <div class="flex items-start gap-2">
                  <UIcon
                    :name="verdictIcon(claim.verdict)"
                    class="mt-0.5 size-4 shrink-0"
                    :class="verdictClass(claim.verdict)"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <UBadge :color="verdictColor(claim.verdict)" variant="soft" size="sm">
                        {{ $t(`articles.editor.factCheck.verdict.${claim.verdict}`) }}
                      </UBadge>
                      <UBadge v-if="claim.importance === 'high'" color="neutral" variant="outline" size="sm">
                        {{ $t('articles.editor.factCheck.highImportance') }}
                      </UBadge>
                    </div>
                    <blockquote class="mt-2 text-sm font-medium leading-5 text-highlighted">
                      “{{ claim.text }}”
                    </blockquote>
                    <p class="mt-2 text-xs leading-5 text-muted">{{ claim.explanation }}</p>
                    <ul v-if="claim.sourceMatches.length" class="mt-2 space-y-1.5">
                      <li
                        v-for="match in claim.sourceMatches"
                        :key="`${claim.id}-${match.sourceIndex}`"
                        class="text-xs leading-5 text-muted"
                      >
                        <a
                          :href="sourceByIndex(match.sourceIndex)?.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="font-medium text-primary hover:underline"
                          >{{ $t('articles.editor.factCheck.sourceNumber', { number: match.sourceIndex + 1 })
                          }}<UIcon name="mdi:open-in-new" class="ml-1 inline size-3"
                        /></a>
                        <span v-if="match.evidence"> — “{{ match.evidence }}”</span>
                      </li>
                    </ul>
                  </div>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="mdi:arrow-right"
                    :aria-label="$t('articles.editor.factCheck.goToClaim')"
                    @click="$emit('navigate', claim.blockIndex)"
                  />
                </div>
              </li>
            </ul>

            <UCollapsible v-if="supportedClaims.length" v-model:open="supportedOpen" class="mt-4">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                class="w-full"
                :ui="{ trailingIcon: 'ms-auto' }"
                icon="mdi:check-circle-outline"
                :trailingIcon="supportedOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                :label="$t('articles.editor.factCheck.supportedClaims', { count: supportedClaims.length })"
              />
              <template #content>
                <ul class="mt-2 space-y-2">
                  <li
                    v-for="claim in supportedClaims"
                    :key="claim.id"
                    class="flex items-start gap-2 text-xs text-muted"
                  >
                    <UIcon name="mdi:check" class="mt-0.5 size-3.5 shrink-0 text-success" />
                    <UButton
                      color="neutral"
                      variant="link"
                      size="xs"
                      :ui="{ base: 'h-auto whitespace-normal p-0 text-left font-normal' }"
                      @click="$emit('navigate', claim.blockIndex)"
                    >
                      {{ claim.text }}
                    </UButton>
                  </li>
                </ul>
              </template>
            </UCollapsible>
          </template>

          <UButton
            v-if="state !== 'running'"
            class="mt-4 w-full"
            color="primary"
            variant="soft"
            icon="mdi:shield-search"
            :disabled="!canRun"
            @click="$emit('run')"
          >
            {{ result ? $t('articles.editor.factCheck.runAgain') : $t('articles.editor.factCheck.run') }}
          </UButton>
          <p v-if="!canRun" class="mt-2 text-xs text-muted">{{ $t('articles.editor.factCheck.notEnoughContent') }}</p>
          <p v-if="result" class="mt-3 text-[11px] leading-4 text-muted">
            {{ $t('articles.editor.factCheck.disclaimer') }}
          </p>
        </div>
      </template>
    </UCollapsible>
  </section>
</template>

<script setup lang="ts">
import type { FactCheckVerdict, ArticleFactCheckResult } from '~~/shared/types/articleFactCheck'

import { sortFactCheckClaims } from '~~/shared/utils/articleFactCheck'

import type { ArticleFactCheckState, ArticleFactCheckErrorKind } from '~/composables/useArticleFactCheck'

const props = defineProps<{
  state: ArticleFactCheckState
  result: ArticleFactCheckResult | null
  canRun: boolean
  errorKind: ArticleFactCheckErrorKind
}>()
defineEmits<{ run: []; navigate: [blockIndex: number]; navigateSources: [] }>()

const open = shallowRef(false)
const supportedOpen = shallowRef(false)
const sorted = computed(() => sortFactCheckClaims(props.result?.claims ?? []))
const supportedClaims = computed(() => sorted.value.filter((claim) => claim.verdict === 'supported'))
const reviewClaims = computed(() => sorted.value.filter((claim) => claim.verdict !== 'supported'))
const sourceIssues = computed(() => (props.result?.sources ?? []).filter((source) => source.status !== 'ready'))
const sourceByIndex = (index: number) => props.result?.sources.find((source) => source.index === index)
const verdictColor = (verdict: FactCheckVerdict) =>
  ({
    supported: 'success',
    partial: 'warning',
    unsupported: 'warning',
    contradicted: 'error',
    unverifiable: 'neutral',
  })[verdict] as 'success' | 'warning' | 'error' | 'neutral'
const verdictIcon = (verdict: FactCheckVerdict) =>
  ({
    supported: 'mdi:check-circle-outline',
    partial: 'mdi:circle-half-full',
    unsupported: 'mdi:help-circle-outline',
    contradicted: 'mdi:close-circle-outline',
    unverifiable: 'mdi:minus-circle-outline',
  })[verdict]
const verdictClass = (verdict: FactCheckVerdict) =>
  ({
    supported: 'text-success',
    partial: 'text-warning',
    unsupported: 'text-warning',
    contradicted: 'text-error',
    unverifiable: 'text-muted',
  })[verdict]
</script>
