<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

import { promptOutcome, runOutcome } from '~~/shared/utils/aiVisibility'

import type { VisibilityPrompt } from '~/types/visibility'
const props = defineProps<{
  prompt: VisibilityPrompt
  canSample: boolean
  running: boolean
  disabled: boolean
  actions: DropdownMenuItem[][]
}>()
const emit = defineEmits<{ run: [] }>()
const open = shallowRef(false)
const outcome = computed(() => promptOutcome(props.prompt.latestRuns))
const tones: Record<string, string> = {
  UNCHECKED: 'bg-accented',
  RUNNING: 'bg-info',
  FAILED: 'bg-error',
  CITED: 'bg-success',
  NOT_CITED: 'bg-neutral-400',
}
</script>
<template>
  <div class="flex min-w-0 items-start gap-2">
    <UCollapsible v-model:open="open" class="min-w-0 flex-1">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :ui="{ base: 'group/prompt h-auto min-h-10 w-full items-start justify-start px-0 py-1' }"
      >
        <span class="flex w-full items-start gap-3 text-left">
          <span class="mt-2 size-2.5 shrink-0 rounded-full" :class="tones[outcome.status]" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-2">
              <span
                class="min-w-0 flex-1 whitespace-normal text-sm font-medium leading-5 text-highlighted"
                :class="{ 'line-clamp-2 sm:line-clamp-1': !open }"
                >{{ prompt.text }}</span
              >
              <UBadge v-if="!prompt.active" color="warning" variant="subtle" size="sm" icon="mdi:pause">
                {{ $t('visibility.prompts.paused') }}
              </UBadge>
            </span>
            <span class="mt-0.5 flex items-center gap-1 text-xs text-muted">
              {{ $t(`visibility.outcome.${outcome.status}`, outcome) }}
              <UIcon
                v-if="prompt.latestRuns.length"
                name="mdi:chevron-down"
                class="size-4 transition-transform group-data-[state=open]/prompt:rotate-180"
                aria-hidden="true"
              />
            </span>
          </span>
        </span>
      </UButton>

      <template #content>
        <p class="py-2 text-xs text-muted">
          {{ prompt.language.toUpperCase() }} · {{ $t(`visibility.prompts.sources.${prompt.source}`) }}
        </p>
        <ul class="mt-2 divide-y divide-default border-t border-default">
          <li v-for="run in prompt.latestRuns" :key="run.id">
            <UCollapsible>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="group/run w-full"
                :ui="{ base: 'justify-start' }"
              >
                <span class="flex w-full items-center gap-3 text-left text-sm">
                  <span class="size-2 shrink-0 rounded-full" :class="tones[runOutcome(run)]" aria-hidden="true" />
                  <span class="min-w-0 flex-1 font-medium text-highlighted">
                    {{ $t(`visibility.providers.${run.provider}`) }}
                  </span>
                  <span class="text-muted">{{ $t(`visibility.runs.${runOutcome(run)}`) }}</span>
                  <NuxtTime :datetime="run.executedAt" relative class="hidden text-xs text-muted sm:inline" />
                  <UIcon
                    name="mdi:chevron-down"
                    class="size-4 shrink-0 text-muted transition-transform group-data-[state=open]/run:rotate-180"
                    aria-hidden="true"
                  />
                </span>
              </UButton>
              <template #content>
                <div class="space-y-4 border-t border-default bg-elevated/35 px-4 py-4">
                  <p v-if="run.error" class="text-sm text-error">{{ run.error }}</p>
                  <div v-else-if="run.responseText">
                    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      {{ $t('visibility.runs.response') }}
                    </p>
                    <StatsAnswerMarkdown :text="run.responseText" class="max-h-96 overflow-y-auto pr-2" />
                  </div>
                  <div v-if="run.citations.length">
                    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      {{ $t('visibility.runs.citations') }}
                    </p>
                    <ul class="space-y-2">
                      <li
                        v-for="citation in run.citations"
                        :key="citation.normalizedUrl"
                        class="flex items-start gap-2 text-sm"
                      >
                        <UIcon
                          :name="citation.owned ? 'mdi:check-circle' : 'mdi:link-variant'"
                          :class="citation.owned ? 'text-success' : 'text-muted'"
                          class="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <a
                          :href="citation.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="min-w-0 truncate text-primary hover:underline"
                        >
                          {{ citation.title || citation.domain }}
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </template>
            </UCollapsible>
          </li>
        </ul>
      </template>
    </UCollapsible>

    <div class="flex shrink-0 items-center gap-1">
      <UButton
        v-if="canSample"
        size="sm"
        color="neutral"
        variant="ghost"
        icon="mdi:radar"
        :loading="running"
        :disabled="!prompt.active || disabled"
        :aria-label="$t('visibility.prompts.run')"
        @click="emit('run')"
      >
        <span class="hidden lg:inline">{{ $t('visibility.prompts.run') }}</span>
      </UButton>
      <UDropdownMenu :items="actions" :content="{ align: 'end' }">
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="mdi:dots-horizontal"
          :aria-label="$t('visibility.prompts.actions')"
        />
      </UDropdownMenu>
    </div>
  </div>
</template>
