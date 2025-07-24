<template>
  <div
    class="sidebar fixed z-50 bg-gray-50 shadow-xl rounded-xl p-4 w-48 md:w-64 mr-12 mt-20 right-0 top-0 max-h-[80vh] overflow-y-auto font-inter"
    aria-label="Table of contents"
  >
    <h2 class="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
      <LucideList class="w-5 h-5 text-blue-600" /> Obsah
    </h2>
    <nav id="toc" class="space-y-2 border-l-2 border-gray-200 pl-2"></nav>
  </div>
</template>

<script lang="ts" setup>
import { LucideList } from 'lucide-vue-next'
import tocbot from 'tocbot'
import { nextTick } from 'vue'

defineProps<{ content: string }>()

const updateActiveLink = (hash: string) => {
  document
    .querySelectorAll('#toc a')
    .forEach((el) => el.classList.remove('active-current'))
  if (hash) {
    document
      .querySelectorAll(`#toc a[href$="#${hash}"]`)
      .forEach((el) => el.classList.add('active-current'))
  }
}

onMounted(async () => {
  tocbot.init({
    tocSelector: '#toc',
    contentSelector: '.prose',
    headingSelector: 'h2',
    scrollSmooth: true,
    scrollSmoothOffset: -80,
    headingsOffset: 80,
    activeLinkClass: '',
    linkClass:
      'text-gray-700 hover:text-blue-800 text-sm block py-1 px-2 rounded-md transition-all duration-200 hover:bg-gray-200',
    hasInnerContainers: true,
  })

  await nextTick()

  setTimeout(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id')
            if (!id) return
            updateActiveLink(id)
          }
        })
      },
      {
        rootMargin: '-35% 0px -60% 0px',
        threshold: 0.1,
      },
    )

    document.querySelectorAll('.prose h2').forEach((section) => {
      if (section.getAttribute('id')) {
        observer.observe(section)
      }
    })

    const hash = window.location.hash.slice(1)
    if (hash) {
      updateActiveLink(hash)
    }

    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.slice(1)
      updateActiveLink(newHash)
    })
  }, 100)
})

onUnmounted(() => {
  tocbot.destroy()
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

.font-inter {
  font-family: 'Inter', sans-serif;
}

.sidebar::-webkit-scrollbar {
  width: 6px;
}
.sidebar::-webkit-scrollbar-thumb {
  background-color: #cbd5e0;
  border-radius: 3px;
}
</style>

<style>
#toc a.active-current {
  font-weight: 600 !important;
  color: #1e40af !important;
  background-color: #dbeafe !important;
  padding-left: 0.75rem !important;
  padding-top: 0.25rem !important;
  padding-bottom: 0.25rem !important;
  border-radius: 0.375rem !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
  transform: scale(1.02) !important;
  transition: all 0.2s !important;
}
</style>
