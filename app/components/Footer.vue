<template>
  <footer
    v-if="clientSite?.plan === 'BASIC'"
    class="mt-auto border-t border-gray-200 bg-white py-5 dark:border-gray-800 dark:bg-#111"
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
