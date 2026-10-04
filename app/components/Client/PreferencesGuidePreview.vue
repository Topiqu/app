<template>
  <details class="group border-t border-default pt-4">
    <summary
      class="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-medium text-muted transition-colors hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden"
    >
      {{ $t('common.preferences.guide.preview.title') }}
      <UIcon
        name="mdi:chevron-down"
        class="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
      />
    </summary>
    <div class="mt-2 rounded-lg border border-default bg-elevated/40 p-4">
      <p class="mb-3 text-xs leading-5 text-muted">{{ $t('common.preferences.guide.preview.hint') }}</p>
      <dl class="space-y-2 font-mono text-xs leading-5">
        <div v-for="line in preview" :key="line.label" class="grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
          <dt class="text-muted">{{ line.label }}:</dt>
          <dd class="min-w-0 text-toned [overflow-wrap:anywhere]">
            <span :class="{ 'text-muted': !line.filled }">{{ line.value }}</span>
            <span v-if="!line.filled" class="ml-2 font-sans text-muted">
              ({{ $t('common.preferences.guide.preview.fallback') }})
            </span>
          </dd>
        </div>
      </dl>
    </div>
  </details>
</template>

<script setup lang="ts">
const props = defineProps<{
  focus: string
  audience: string
  language: string
  keywords: string[]
}>()

// These labels and defaults mirror the topic prompt in server/utils/ai/topic.ts.
const preview = computed(() => {
  const line = (label: string, value: string, fallback: string) => ({
    label,
    value: value.trim() || fallback,
    filled: Boolean(value.trim()),
  })
  return [
    line('Audience', props.audience, 'general'),
    line('Focus', props.focus, 'general topics'),
    line('Keywords', props.keywords.join(', '), 'none'),
    line('Language', props.language.toUpperCase(), ''),
  ]
})
</script>
