<template>
  <section
    class="flex flex-col gap-3 rounded-lg border border-default bg-elevated/30 p-4 sm:flex-row sm:items-center sm:p-5"
  >
    <div class="min-w-0 flex-1">
      <h2 class="text-sm font-semibold text-highlighted">{{ $t('knowledge.website.title') }}</h2>
      <p class="mt-1 break-all text-sm text-highlighted">{{ url }}</p>
      <p class="mt-1 text-sm text-muted">{{ $t('knowledge.website.description') }}</p>
    </div>
    <UButton icon="mdi:web-plus" class="shrink-0" :disabled="disabled" @click="emit('import')">
      {{ $t('knowledge.website.action') }}
    </UButton>
  </section>
</template>

<script setup lang="ts">
defineProps<{ url: string; disabled?: boolean }>()
const emit = defineEmits<{ import: [] }>()
</script>
