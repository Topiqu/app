<template>
  <div
    v-tippy="{ content: shortcode, placement: 'top' }"
    class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100 px-2 py-1 text-xs text-neutral-600 shadow-sm sm:px-3 sm:py-1.5 sm:text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
  >
    <img :src="imageUrl" :alt="shortcode" class="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
    <span>{{ count }}</span>
  </div>
</template>

<script setup lang="ts">
import { directive as vTippy } from 'vue-tippy'

defineProps<{ imageUrl: string; shortcode: string; count: number }>()
</script>
