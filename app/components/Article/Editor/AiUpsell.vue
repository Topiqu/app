<template>
  <div class="flex flex-col items-start gap-3 rounded-(--topiqu-surface-radius) bg-primary/5 p-5">
    <UIcon name="mdi:creation-outline" class="size-6 text-primary" aria-hidden="true" />
    <h3 class="font-semibold text-highlighted">{{ $t('articles.editor.ai.upsell.title') }}</h3>
    <p class="text-sm leading-6 text-muted">{{ $t('articles.editor.ai.upsell.description') }}</p>
    <UButton :to="localePath({ name: 'settings', query: { tab: 'billing' } })" icon="mdi:star-four-points">
      {{ $t('articles.editor.ai.upsell.cta') }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
</script>
