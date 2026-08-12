<template>
  <div v-if="content" class="relative inline-block">
    <img
      :src="optimizedContent"
      alt="GIF"
      width="200"
      height="150"
      loading="lazy"
      decoding="async"
      class="h-auto max-w-[200px] rounded-lg shadow-md"
    />
    <Button
      v-if="cancellable"
      icon="mdi:close"
      variant="danger"
      size="sm"
      class="absolute top-1 right-1 rounded-full"
      animation="softpop"
      :aria="$t('articles.comments.removeGif')"
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
