<template>
  <div v-if="content" class="relative inline-block">
    <NuxtImg :src="content" alt="GIF" class="max-w-[200px] rounded-lg shadow-md" />
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
</script>
