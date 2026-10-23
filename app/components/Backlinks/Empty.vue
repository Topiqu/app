<template>
  <section class="overflow-hidden rounded-(--topiqu-surface-radius) border border-default bg-default">
    <div class="p-5 sm:p-6">
      <div class="flex items-start gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-elevated text-muted"
          aria-hidden="true"
        >
          <UIcon name="mdi:link-plus" class="size-5" />
        </span>
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-highlighted">
            {{ $t(running ? 'backlinks.running' : 'backlinks.empty.title') }}
          </h2>
          <p class="mt-1 max-w-xl text-sm leading-6 text-muted">{{ $t('backlinks.empty.description') }}</p>
        </div>
      </div>

      <ol class="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-6">
        <li v-for="(step, index) in steps" :key="step" class="flex items-start gap-2.5 text-sm">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-full border border-default text-xs tabular-nums text-muted"
            aria-hidden="true"
          >
            {{ index + 1 }}
          </span>
          <span class="pt-0.5 text-highlighted">{{ $t(`backlinks.empty.steps.${step}`) }}</span>
        </li>
      </ol>
    </div>
    <div
      class="flex flex-col items-start gap-2 border-t border-default bg-elevated/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <UButton icon="mdi:magnify" :loading="busy || running" :disabled="!canRefresh" @click="emit('search')">
        {{ $t(running ? 'backlinks.running' : 'backlinks.refresh') }}
      </UButton>
      <p class="text-xs leading-5 text-muted" role="status">{{ refreshNote }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ canRefresh: boolean; busy: boolean; running: boolean; refreshNote: string }>()
const emit = defineEmits<{ search: [] }>()
const steps = ['discover', 'contact', 'verify'] as const
</script>
