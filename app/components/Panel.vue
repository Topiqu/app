<template>
  <section
    class="rounded-[var(--topiqu-surface-radius)] border bg-white p-5 shadow-sm dark:bg-neutral-900 sm:p-6"
    :class="danger ? 'border-red-200 dark:border-red-900/60' : 'border-neutral-200 dark:border-neutral-800'"
  >
    <header v-if="title" class="flex items-start justify-between gap-4 mb-5">
      <div class="min-w-0">
        <h2
          class="text-base font-semibold tracking-tight"
          :class="danger ? 'text-red-700 dark:text-red-400' : 'text-neutral-900 dark:text-neutral-100'"
        >
          {{ title }}
        </h2>
        <p v-if="description" class="mt-1 text-sm text-neutral-500 dark:text-neutral-400 text-pretty">
          {{ description }}
        </p>
      </div>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
// `danger` is the one intentional exception to the neutral surface — it marks irreversible actions.
defineProps<{ title?: string; description?: string; danger?: boolean }>()
</script>
