<template>
  <transition
    enter-active-class="transition transform duration-300 ease-out"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition transform duration-300 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <div
      v-show="isOpen"
      class="sidebar fixed z-[1000] bg-white shadow-lg p-2 flex flex-col justify-center items-center gap-4 rounded-md"
      :class="
        isMobile
          ? 'top-0 left-0 w-28 max-w-[90%] h-full p-1 gap-2'
          : 'top-72 left-8 w-14 h-48 p-2 gap-4'
      "
    >
      <button class="icon-btn" @click="articleCreateOpen = true">
        <Icon name="mdi:pencil" class="w-6 h-6 text-black" />
      </button>
      <button class="icon-btn" @click="tagsOpen = true">
        <Icon name="mdi:tag-outline" class="w-6 h-6 text-black" />
      </button>
      <button class="icon-btn">
        <Icon name="mdi:chart-bar" class="w-6 h-6 text-black" />
      </button>
    </div>
  </transition>

  <transition
    enter-active-class="transition-opacity duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isMobile && isOpen"
      class="fixed inset-0 z-30 bg-black/40"
      @click="$emit('update:isOpen', false)"
    />
  </transition>

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
const emit = defineEmits(['update:isOpen'])

const isMobile = ref(false)

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768
}
onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
})

watch(
  isMobile,
  (mobile) => {
    if (!mobile) emit('update:isOpen', true)
  },
  { immediate: true },
)

const articleCreateOpen = ref(false)
const tagsOpen = ref(false)
</script>

<style scoped>
.sidebar {
  transition:
    opacity 0.3s ease,
    width 0.3s ease;
}
.sidebar:hover {
  opacity: 0.5;
}
.icon-btn {
  @apply w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors;
}
</style>
