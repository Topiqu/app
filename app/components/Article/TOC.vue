<template>
  <div
    class="sidebar hidden sm:block fixed z-50 bg-gray-50 shadow-xl rounded-xl p-4 w-48 md:w-64 mr-12 mt-20 right-0 top-0 max-h-[40vh] overflow-y-auto"
    aria-label="Table of contents"
  >
    <h2 class="text-base font-bold flex items-center gap-2 mb-4"><LucideList class="w-5 h-5 text-blue-600" /> Obsah</h2>
    <nav id="toc" class="space-y-2 border-l-2 border-gray-200 pl-2" />
  </div>
</template>

<script lang="ts" setup>
import tocbot from 'tocbot'
import { LucideList } from 'lucide-vue-next'
const props = defineProps<{ content: string }>()

const updateActiveLink = (target: string | HashChangeEvent) => {
  const hash = typeof target === 'string' ? target : new URL(target.newURL).hash.slice(1)

  document.querySelectorAll('#toc a').forEach((el) => el.classList.remove('active-current'))

  if (hash) {
    document.querySelectorAll(`#toc a[href$="#${hash}"]`).forEach((el) => el.classList.add('active-current'))
  }
}

const initToc = async () => {
  await nextTick()

  const headings = document.querySelectorAll('.prose h1, .prose h2, .prose h3')

  if (!headings.length) {
    document.querySelector('#toc')!.innerHTML = '<p class="text-sm text-gray-500">Žádný obsah k zobrazení</p>'
    return
  }

  headings.forEach((h, i) => {
    if (!h.id) h.id = `heading-${i}`
  })

  tocbot.init({
    tocSelector: '#toc',
    contentSelector: '.prose',
    headingSelector: 'h1, h2, h3',
    scrollSmooth: true,
    scrollSmoothOffset: -100,
    headingsOffset: 100,
    linkClass:
      'toc-link text-gray-700 hover:text-blue-800 text-sm block py-1 px-2 rounded-md transition-all duration-200 hover:bg-gray-200',
    extraLinkClasses: 'h3-link',
    collapseDepth: 0,
    orderedList: false,
    hasInnerContainers: true,
  })

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id
          if (id) updateActiveLink(id)
        }
      })
    },
    {
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0.2,
    },
  )

  headings.forEach((h) => h.id && observer.observe(h))

  const initialHash = window.location.hash.slice(1)
  if (initialHash) updateActiveLink(initialHash)
}

onMounted(() => {
  initToc()
  window.addEventListener('hashchange', updateActiveLink)
})

watch(
  () => props.content,
  () => {
    tocbot.destroy()
    initToc()
  },
)

onUnmounted(() => {
  tocbot.destroy()
  window.removeEventListener('hashchange', updateActiveLink)
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

.font-inter {
  font-family: 'Inter', sans-serif;
}

.sidebar::-webkit-scrollbar {
  width: 6px;
}
.sidebar::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar::-webkit-scrollbar-thumb {
  background-color: #cbd5e0;
  border-radius: 3px;
  transition: background-color 0.2s ease;
}
.sidebar:hover::-webkit-scrollbar-thumb {
  background-color: #94a3b8;
}

#toc a {
  display: block;
  font-size: 0.875rem;
  color: #374151;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}
#toc a:hover {
  background-color: #e5e7eb;
  color: #1d4ed8;
}
#toc a.h3-link {
  padding-left: 1.25rem;
  font-size: 0.8125rem;
  color: #6b7280;
}
#toc a.active-current {
  font-weight: 600;
  color: #1e40af;
  background-color: #dbeafe;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transform: scale(1.02);
}
#toc a.active-current::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background-color: #2563eb;
  border-radius: 2px;
}
</style>
