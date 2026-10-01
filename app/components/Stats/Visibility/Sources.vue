<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

import type { VisibilityDomain } from '~/types/visibility'
defineProps<{
  groups: { key: 'competitors' | 'references' | 'others'; rows: VisibilityDomain[] }[]
  hidden: string[]
  ownShare: number
  actions: (row: VisibilityDomain) => DropdownMenuItem[][]
}>()
const emit = defineEmits<{ restore: [domain: string] }>()
const { locale } = useI18n()
const percent = (value: number) =>
  new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 0 }).format(value)
</script>
<template>
  <section v-if="groups.length || hidden.length" class="border-t border-default pt-4">
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
      <p class="mb-4 mt-1 text-sm text-muted">{{ $t('visibility.domains.description') }}</p>
      <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="group in groups" :key="group.key" class="min-w-0">
          <h3 class="text-sm font-medium text-muted">{{ $t(`visibility.domains.${group.key}`) }}</h3>
          <p v-if="group.key === 'references'" class="mt-0.5 text-xs text-muted">
            {{ $t('visibility.domains.referencesHint') }}
          </p>
          <ul class="mt-2 divide-y divide-default">
            <li v-if="group.key === 'competitors'" class="py-2.5">
              <div class="flex items-center justify-between gap-4 text-sm">
                <span class="font-semibold text-highlighted">{{ $t('visibility.domains.you') }}</span>
                <span class="font-semibold tabular-nums">{{ percent(ownShare) }}</span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accented" aria-hidden="true">
                <div class="h-full rounded-full bg-success" :style="{ width: `${ownShare * 100}%` }" />
              </div>
            </li>
            <li v-for="row in group.rows" :key="row.domain" class="py-1.5">
              <div class="flex items-center gap-2 text-sm">
                <span class="min-w-0 flex-1 truncate text-highlighted">{{ row.domain }}</span>
                <UIcon
                  v-if="row.marked"
                  name="mdi:bookmark"
                  class="size-4 shrink-0 text-muted"
                  :aria-label="$t('visibility.domains.marked')"
                />
                <span class="hidden text-xs tabular-nums text-muted sm:inline">{{
                  $t('visibility.domains.prompts', { count: row.prompts })
                }}</span
                ><span class="w-12 text-right tabular-nums">{{ percent(row.share) }}</span>
                <UDropdownMenu :items="actions(row)" :content="{ align: 'end' }">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="mdi:dots-horizontal"
                    :aria-label="$t('visibility.domains.actions', { domain: row.domain })"
                  />
                </UDropdownMenu>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div v-if="hidden.length" class="flex flex-wrap items-center gap-2 border-t border-default px-5 py-3">
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
