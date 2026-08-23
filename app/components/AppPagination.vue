<template>
  <UPagination :page :total="totalPages" :itemsPerPage="1" @update:page="changePage" />
</template>

<script setup lang="ts">
const props = defineProps<{ page: number; totalPages: number; prevPage?: () => void; nextPage?: () => void }>()

const changePage = (next: number) => {
  if (next < props.page) props.prevPage?.()
  else if (next > props.page) props.nextPage?.()
}
</script>
