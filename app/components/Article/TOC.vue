<template>
  <div v-show="hasHeadings">
    <div
      v-if="isMobileOpen"
      class="fixed inset-0 z-40 bg-gray-900/10 backdrop-blur-sm transition-opacity sm:hidden dark:bg-black/40"
      @click="isMobileOpen = false"
    />

    <Button
      v-show="!isMobileOpen"
      square
      size="lg"
      variant="neutral"
      icon="i-lucide:list"
      class="fixed top-24 right-6 z-40 shadow-xl ring-1 ring-black/5 backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 sm:hidden dark:ring-white/10"
      :aria="String($t('articles.tableOfContents.title'))"
      @click="isMobileOpen = true"
    />

    <div
      :class="[
        'fixed z-50 flex flex-col overflow-hidden bg-white/95 shadow-2xl ring-1 ring-gray-900/5 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] sm:bg-transparent sm:shadow-none sm:ring-0 sm:backdrop-blur-none dark:bg-neutral-900/95 dark:ring-white/10 sm:dark:bg-transparent',
        isMobileOpen
          ? 'top-[9.5rem] right-6 w-[17rem] origin-top-right scale-100 rounded-2xl opacity-100 max-h-[60vh]'
          : 'pointer-events-none top-[9.5rem] right-6 w-[17rem] origin-top-right scale-95 opacity-0 sm:pointer-events-auto sm:top-20 sm:bottom-auto sm:mt-0 sm:mr-12 sm:scale-100 sm:opacity-100 sm:max-h-[calc(100vh-8rem)] rounded-xl',
      ]"
    >
      <div
        class="flex items-center justify-between border-b border-gray-100/50 px-5 py-3.5 sm:border-none sm:pb-3 dark:border-white/5"
      >
        <h2 class="flex items-center gap-2.5 text-[13px] font-semibold tracking-wide text-gray-900 dark:text-gray-100">
          <Icon name="i-lucide:align-left" class="h-4 w-4 text-blue-600 dark:text-blue-500" />
          {{ $t('articles.tableOfContents.title') }}
        </h2>
        <Button
          v-if="isMobileOpen"
          square
          borderless
          size="sm"
          variant="neutral"
          icon="i-lucide:x"
          class="sm:hidden -mr-2"
          @click="isMobileOpen = false"
        />
      </div>

      <div class="overflow-y-auto px-5 pb-5 pt-2 sidebar">
        <nav id="toc" class="space-y-0.5 relative" @click="handleNavClick" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import tocbot from 'tocbot'

const props = defineProps<{ content: string }>()

const hasHeadings = shallowRef(true)
const isMobileOpen = shallowRef(false)

const normalizeId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const updateActiveLink = (target: string | HashChangeEvent) => {
  const hash = typeof target === 'string' ? target : new URL(target.newURL).hash.slice(1)
  document.querySelectorAll('#toc a').forEach((el) => el.classList.remove('active-current'))
  if (hash) {
    try {
      document
        .querySelectorAll(`#toc a[href$="#${CSS.escape(hash)}"]`)
        .forEach((el) => el.classList.add('active-current'))
    } catch (e: any) {
      console.error(e)
    }
  }
}

const handleNavClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'A') {
    isMobileOpen.value = false
  }
}

const initToc = async () => {
  await nextTick()
  const headings = document.querySelectorAll('.prose h1, .prose h2, .prose h3')
  if (!headings.length) {
    hasHeadings.value = false
    return
  }

  hasHeadings.value = true

  headings.forEach((h, i) => {
    if (!h.id) {
      const text = h.textContent || `heading-${i}`
      h.id = normalizeId(text)
    }
  })

  tocbot.init({
    tocSelector: '#toc',
    contentSelector: '.prose',
    headingSelector: 'h1, h2, h3',
    scrollSmooth: true,
    scrollSmoothOffset: -100,
    headingsOffset: 100,
    linkClass: 'toc-link',
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

.font-inter {
  font-family: 'Inter', sans-serif;
}

.sidebar::-webkit-scrollbar {
  width: 4px;
}
.sidebar::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 4px;
}
.sidebar:hover::-webkit-scrollbar-thumb {
  background-color: #94a3b8;
}
.dark .sidebar::-webkit-scrollbar-thumb {
  background-color: #475569;
}

#toc {
  border-left: 1px solid #e2e8f0;
  position: relative;
}
.dark #toc {
  border-left-color: #3f3f46;
}

#toc .toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

#toc .toc-list .toc-list {
  padding-left: 0;
}

#toc a.toc-link {
  display: block;
  position: relative;
  font-size: 0.8125rem;
  padding: 0.375rem 0.5rem 0.375rem 1rem;
  color: #64748b;
  text-decoration: none;
  line-height: 1.25rem;
  transition: all 0.2s ease;
  margin-left: -1px;
  border-left: 1px solid transparent;
}
.dark #toc a.toc-link {
  color: #a1a1aa;
}

#toc .toc-list .toc-list a.toc-link {
  padding-left: 1.5rem;
}
#toc .toc-list .toc-list .toc-list a.toc-link {
  padding-left: 2rem;
}

#toc a.toc-link:hover {
  color: #0f172a;
}
.dark #toc a.toc-link:hover {
  color: #f4f4f5;
}

#toc a.toc-link.active-current {
  font-weight: 500;
  color: #2563eb;
  border-left-color: #2563eb;
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.04) 0%, rgba(255, 255, 255, 0) 100%);
}
.dark #toc a.toc-link.active-current {
  color: #3b82f6;
  border-left-color: #3b82f6;
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
}
</style>
