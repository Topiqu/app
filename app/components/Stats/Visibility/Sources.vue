<template>
  <section v-if="groups.length || hidden.length" class="border-t border-default pt-4">
    <DefineActions v-slot="{ row }">
      <UDropdownMenu :items="actions(row)" :content="{ align: 'end' }">
        <UButton
          square
          size="xs"
          color="neutral"
          variant="ghost"
          icon="mdi:dots-horizontal"
          :aria-label="$t('visibility.domains.actions', { domain: row.domain })"
        />
      </UDropdownMenu>
    </DefineActions>
    <details class="group/sources">
      <summary
        class="flex cursor-pointer list-none items-center justify-between gap-3 py-1 text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
      >
        <h2 class="text-base font-semibold">{{ $t('visibility.domains.title') }}</h2>
        <UIcon
          name="mdi:chevron-down"
          class="size-4 shrink-0 text-muted transition-transform group-open/sources:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <p class="mb-5 mt-1 max-w-2xl text-sm text-muted">{{ $t('visibility.domains.description') }}</p>

      <div class="grid gap-x-10 gap-y-6" :class="references && primary.length ? 'lg:grid-cols-[minmax(0,1fr)_16rem]' : ''">
        <div v-if="primary.length" class="flex min-w-0 flex-col gap-6">
          <div v-for="group in primary" :key="group.key" class="min-w-0">
            <h3 class="text-sm font-semibold text-highlighted">{{ $t(`visibility.domains.${group.key}`) }}</h3>
            <ul class="mt-2 divide-y divide-default">
              <li v-if="group.key === 'competitors'" class="py-2.5">
                <div class="flex items-center gap-3 text-sm">
                  <span class="min-w-0 flex-1 font-semibold text-highlighted">{{ $t('visibility.domains.you') }}</span>
                  <span class="w-12 text-right font-semibold tabular-nums">{{ percent(ownShare) }}</span>
                  <span class="w-6" aria-hidden="true" />
                </div>
                <div class="mt-1.5 mr-9 h-1 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                  <div class="h-full rounded-full bg-success" :style="{ width: `${ownShare * 100}%` }" />
                </div>
              </li>
              <li v-for="row in group.rows" :key="row.domain" class="py-2">
                <div class="flex items-center gap-3 text-sm">
                  <span class="min-w-0 flex-1 truncate text-highlighted">{{ row.domain }}</span>
                  <UIcon
                    v-if="row.marked"
                    name="mdi:bookmark"
                    class="size-4 shrink-0 text-primary"
                    :aria-label="$t('visibility.domains.marked')"
                  />
                  <span class="hidden shrink-0 text-xs tabular-nums text-muted sm:inline">
                    {{ $t('visibility.domains.prompts', { n: row.prompts }, row.prompts) }}
                  </span>
                  <span class="w-12 text-right font-medium tabular-nums">{{ percent(row.share) }}</span>
                  <ReuseActions :row />
                </div>
                <div class="mt-1.5 mr-9 h-1 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                  <div class="h-full rounded-full bg-neutral-400 dark:bg-neutral-500" :style="{ width: `${row.share * 100}%` }" />
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Reference sources (Wikipedia, forums, authorities) cannot be outranked by an article: context, not targets. -->
        <aside v-if="references" class="min-w-0 self-start rounded-(--topiqu-surface-radius) bg-elevated/50 p-4">
          <h3 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <UIcon name="mdi:bookshelf" class="size-4" aria-hidden="true" />
            {{ $t('visibility.domains.references') }}
          </h3>
          <p class="mt-1 text-xs leading-5 text-muted">{{ $t('visibility.domains.referencesHint') }}</p>
          <ul class="mt-2">
            <li v-for="row in references.rows" :key="row.domain" class="flex items-center gap-2 py-1 text-sm">
              <span class="min-w-0 flex-1 truncate text-muted">{{ row.domain }}</span>
              <span class="tabular-nums text-xs text-muted">{{ percent(row.share) }}</span>
              <ReuseActions :row />
            </li>
          </ul>
        </aside>
      </div>

      <div v-if="hidden.length" class="mt-5 flex flex-wrap items-center gap-2 border-t border-default pt-3">
        <span class="text-xs text-muted">{{ $t('visibility.domains.hidden') }}</span>
        <UButton
          v-for="domain in hidden"
          :key="domain"
          size="xs"
          color="neutral"
          variant="soft"
          trailingIcon="mdi:eye-outline"
          :aria-label="$t('visibility.domains.restore', { domain })"
          @click="emit('restore', domain)"
        >
          {{ domain }}
        </UButton>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

import type { VisibilityDomain } from '~/types/visibility'

const props = defineProps<{
  groups: { key: 'competitors' | 'references' | 'others'; rows: VisibilityDomain[] }[]
  hidden: string[]
  ownShare: number
  actions: (row: VisibilityDomain) => DropdownMenuItem[][]
}>()
const emit = defineEmits<{ restore: [domain: string] }>()

const [DefineActions, ReuseActions] = createReusableTemplate<{ row: VisibilityDomain }>()
const { locale } = useI18n()

const primary = computed(() => props.groups.filter((group) => group.key !== 'references'))
const references = computed(() => props.groups.find((group) => group.key === 'references'))
const percent = (value: number) =>
  new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(value)
</script>
