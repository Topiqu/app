<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to
    class="group relative flex items-center gap-3 rounded-lg px-2 py-2 -mx-2"
    :class="
      to
        ? 'transition-colors motion-reduce:transition-none hover:bg-neutral-900/[0.04] dark:hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        : ''
    "
  >
    <span
      v-if="rank !== undefined"
      class="w-5 shrink-0 text-xs font-semibold tabular-nums text-neutral-400 dark:text-neutral-500"
    >
      {{ rank }}
    </span>
    <!-- Decorative: the metric is named by the unit in `value` ("4 zobrazení"), so the glyph
         repeats it rather than carrying it. -->
    <UIcon
      v-else-if="icon"
      :name="icon"
      class="size-4 shrink-0 text-neutral-400 dark:text-neutral-500"
      aria-hidden="true"
    />

    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100" :title="label">
        {{ label }}
      </span>
      <!-- Share of the leader, so the eye ranks the list before reading a single number. Neutral
           on purpose: colour in this modal means money or interactivity, never quantity. -->
      <span
        v-if="bar !== undefined"
        class="mt-1.5 block h-1 rounded-full bg-neutral-900/[0.06] dark:bg-white/10"
        role="presentation"
      >
        <span
          class="block h-full rounded-full bg-neutral-900/25 dark:bg-white/30"
          :style="{ width: `${Math.max(bar * 100, 2)}%` }"
        />
      </span>
    </span>

    <span
      class="max-w-[40%] shrink-0 truncate whitespace-nowrap text-sm tabular-nums text-neutral-500 dark:text-neutral-400"
      :title="value"
    >
      {{ value }}
    </span>
  </component>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import { NuxtLink } from '#components'

defineProps<{
  label: string
  value: string
  to?: RouteLocationRaw
  rank?: number
  icon?: string
  /** 0–1 share of the largest value in the list; omit to hide the bar. */
  bar?: number
}>()
</script>
