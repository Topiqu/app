<template>
  <div
    class="rounded-2xl bg-neutral-100/70 p-2 dark:bg-neutral-800/50"
    role="group"
    :aria-label="$t('emoji.commentPreview')"
  >
    <div v-if="total > 1" class="flex items-center justify-end gap-1 px-1 pb-2">
      <Button
        type="button"
        square
        size="sm"
        variant="transparent"
        icon="mdi:chevron-left"
        :aria="$t('emoji.previousPreview')"
        @click="emit('previous')"
      />
      <span class="min-w-10 text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
        {{ current }} / {{ total }}
      </span>
      <Button
        type="button"
        square
        size="sm"
        variant="transparent"
        icon="mdi:chevron-right"
        :aria="$t('emoji.nextPreview')"
        @click="emit('next')"
      />
    </div>
    <div
      class="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div class="flex items-center gap-3">
        <div
          class="grid size-8 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
        >
          T
        </div>
        <div>
          <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{{ $t('emoji.previewAuthor') }}</p>
          <p class="text-xs text-neutral-400">{{ $t('emoji.previewTime') }}</p>
        </div>
      </div>
      <p class="mt-3 text-sm text-neutral-700 dark:text-neutral-200">{{ $t('emoji.previewComment') }}</p>
      <div class="mt-4 flex items-center gap-2">
        <Button size="sm" variant="neutral" icon="mdi:thumb-up-outline"><span>3</span></Button>
        <Button size="sm" variant="neutral" icon="mdi:thumb-down-outline"><span>0</span></Button>
        <EmojiReactionChip :imageUrl :shortcode :count="1" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ imageUrl: string; shortcode: string; current: number; total: number }>()
const emit = defineEmits<{ previous: []; next: [] }>()
</script>
