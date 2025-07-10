<template>
  <transition name="slide">
    <div
      v-if="isMobile || isOpen"
      :class="[
        'fixed z-40 bg-white shadow-lg p-2 flex flex-col justify-center items-center gap-4',
        isMobile ? 'left-0 w-64' : 'left-8 w-14 ml-2 rounded-md h-48',
      ]"
    >
      <button
        class="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
        @click="articleCreateOpen = true"
      >
        <Icon name="mdi:pencil" class="w-6 h-6 text-black" />
      </button>
      <button
        class="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
        @click="tagsOpen = true"
      >
        <Icon name="mdi:tag-outline" class="w-6 h-6 text-black" />
      </button>
      <button
        class="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
      >
        <Icon name="mdi:chart-bar" class="w-6 h-6 text-black" />
      </button>
    </div>
  </transition>

  <div v-if="isMobile && isOpen" class="fixed inset-0 z-30 bg-black/40" />

  <TransitionRoot :show="articleCreateOpen" as="template">
    <ArticleCreate @close="articleCreateOpen = false" />
  </TransitionRoot>
  <TransitionRoot :show="tagsOpen" as="template">
    <TagsCreate @close="tagsOpen = false" />
  </TransitionRoot>
</template>

<script setup lang="ts">
import { TransitionRoot } from '@headlessui/vue'
defineProps<{ isOpen: boolean }>()

const isMobile = computed(() => window.innerWidth < 768)
const articleCreateOpen = ref(false)
const tagsOpen = ref(false)
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
