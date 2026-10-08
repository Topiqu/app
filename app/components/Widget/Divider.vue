<template>
  <div
    role="separator"
    :aria-label="config.label || undefined"
    class="flex items-center gap-4 text-muted"
    :class="config.style === 'space' ? 'h-12' : 'py-2'"
  >
    <template v-if="config.style !== 'space'">
      <svg
        v-for="side in config.label ? 2 : 1"
        :key="side"
        class="h-2 min-w-0 flex-1 text-[var(--client-accent,currentColor)]"
        viewBox="0 0 120 8"
        preserveAspectRatio="none"
        aria-hidden="true"
        :class="{ 'order-last': side === 2 }"
      >
        <path
          :d="config.style === 'wave' ? WAVE : 'M0 4 H120'"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          :stroke-dasharray="config.style === 'dots' ? '0 6' : undefined"
          stroke-linecap="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span v-if="config.label" class="shrink-0 text-xs font-semibold uppercase tracking-widest">{{ config.label }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DividerConfig } from '~~/shared/utils/widgets'

const { config } = defineProps<{ config: DividerConfig }>()

const WAVE = 'M0 4 Q7.5 0 15 4 T30 4 T45 4 T60 4 T75 4 T90 4 T105 4 T120 4'
</script>
