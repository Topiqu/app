<template>
  <div
    class="sidebar fixed z-50 bg-white shadow-lg rounded-md p-2 max-w-[90%] right-0 top-0 w-40 md:w-40 md:p-2 mr-12 mt-12"
    aria-label="Table of contents"
  >
    <h2 class="text-base font-semibold text-gray-800 mb-1">Obsah</h2>
    <div id="toc" class="space-y-1"></div>
  </div>
  <div class="bg-white shadow-lg rounded-md p-2 w-full md:hidden">
    <details>
      <summary
        class="text-base font-semibold text-gray-800 cursor-pointer flex items-center justify-between"
      >
        Obsah
      </summary>
      <div id="toc-mobile" class="space-y-1 mt-1"></div>
    </details>
  </div>
</template>

<script lang="ts" setup>
import tocbot from 'tocbot'

defineProps<{ content: string }>()

onMounted(() => {
  tocbot.init({
    tocSelector: '#toc, #toc-mobile',
    contentSelector: '.prose',
    headingSelector: 'h2, h3',
    scrollSmooth: true,
    scrollSmoothOffset: -80,
    headingsOffset: 80,
    activeLinkClass:
      'font-semibold text-blue-800 border-l-2 border-blue-600 pl-2',
    linkClass:
      'text-blue-600 hover:text-blue-800 no-underline hover:underline text-sm block transition-all duration-200 hover:pl-3',
  })
})

onUnmounted(() => {
  tocbot.destroy()
})
</script>

<style scoped>
.sidebar {
  transition:
    opacity 0.3s ease,
    width 0.3s ease;
}
.sidebar:hover {
  opacity: 0.95;
}
details[open] .rotate-180 {
  transform: rotate(180deg);
}
.toc-list .toc-link {
  transition: all 0.2s ease;
}
.toc-list .is-active-link {
  transform: scale(1.02);
}
</style>
