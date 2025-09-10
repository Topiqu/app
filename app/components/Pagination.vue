<template>
  <div class="flex items-center justify-between p-2">
    <Button icon="mdi:chevron-left" variant="neutral" :disabled="page <= 1" @click="prevPage">
      <span class="hidden sm:inline">{{ $t('articles.pagination.previous') }}</span>
    </Button>

    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ $t('articles.pagination.pageInfo', [page, totalPages === 0 ? 1 : totalPages]) }}
    </span>

    <Button
      :disabled="page >= totalPages"
      icon="mdi:chevron-right"
      iconPosition="right"
      variant="neutral"
      @click="nextPage"
    >
      <span class="hidden sm:inline">{{ $t('articles.pagination.next') }}</span>
    </Button>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  page: number
  totalPages: number
  prevPage: () => void
  nextPage: () => void
}>()
</script>
