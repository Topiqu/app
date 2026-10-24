<template>
  <div
    v-if="content"
    class="relative mt-2 inline-block max-w-[min(100%,24rem)] overflow-hidden rounded-[var(--ui-radius)] align-top"
  >
    <NuxtImg
      :src="optimizedContent"
      alt="GIF"
      width="480"
      sizes="240px sm:320px md:480px"
      class="block h-auto w-auto max-w-full object-contain"
      :class="size === 'sm' ? 'max-h-40' : 'max-h-72'"
    />
    <UButton
      v-if="cancellable"
      icon="mdi:close"
      color="error"
      variant="solid"
      size="sm"
      square
      class="absolute top-1 right-1"
      :aria-label="$t('articles.comments.removeGif')"
      @click="content = null"
    />
  </div>
</template>
<script lang="ts" setup>
const { cancellable = false, size = 'md' } = defineProps<{
  cancellable?: boolean
  size?: 'sm' | 'md'
}>()
const content = defineModel<string | null>('content')
const optimizedContent = computed(() => content.value?.replace(/\/giphy\.gif(?=[?#]|$)/i, '/giphy.webp'))
</script>
