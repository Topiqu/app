<template>
  <div v-if="content" class="relative w-full max-w-[200px]">
    <AppMedia
      :src="optimizedContent"
      alt="GIF"
      aspectRatio="1 / 1"
      fit="contain"
      sizes="200px"
      containerClass="w-full rounded-lg"
    />
    <UButton
      v-if="cancellable"
      icon="i-mdi-close"
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
const { cancellable = false } = defineProps<{
  cancellable?: boolean
}>()
const content = defineModel<string | null>('content')
const optimizedContent = computed(() => content.value?.replace(/\/giphy\.gif(?=[?#]|$)/i, '/giphy.webp'))
</script>
