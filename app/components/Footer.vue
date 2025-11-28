<template>
  <footer
    v-if="clientSite?.plan === 'BASIC'"
    class="sticky bottom-0 z-10 bg-white dark:bg-#111 border-t border-gray-200 dark:border-gray-800 py-5"
  >
    <div class="flex items-center justify-center gap-4 text-base">
      <strong class="font-500 text-gray-700 dark:text-gray-300">Made with</strong>
      <NuxtImg src="/topik_normal_rm.png" alt="Topiqu" class="w-14 h-14" />
      <span class="font-700 text-xl bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
        Topiqu
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
const clientSite = await useClientSite()
</script>
