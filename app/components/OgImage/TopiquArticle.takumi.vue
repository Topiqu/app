<template>
  <div class="w-[1200px] h-[630px] flex bg-[#0f172a] relative overflow-hidden">
    <img
      v-if="backgroundImage"
      :src="backgroundImage"
      style="width: 1200px; height: 630px; object-fit: cover; position: absolute; top: 0; left: 0"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  backgroundImage?: string | null
}>()
</script>
