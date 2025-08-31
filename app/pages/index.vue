<template>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
    <section
      class="relative bg-gradient-to-r from-blue-600 to-indigo-900 dark:from-gray-900 dark:to-black rounded-3xl py-12 px-6 text-center shadow-xl overflow-hidden animate-gradient-x [animation-duration:8s]"
    >
      <NuxtImg
        v-if="clientSite?.logoUrl"
        :src="clientSite.logoUrl"
        class="w-16 h-16 mx-auto mb-4 rounded-full object-cover border border-white/20 relative z-20"
        alt="Logo"
      />
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold drop-shadow text-white">
        {{ clientSite?.name ?? 'GameDev' }}
      </h1>
      <p class="mt-4 text-lg sm:text-xl max-w-3xl mx-auto text-white/80 dark:text-white/80">
        {{ clientSite?.description ?? 'Nejnovější trendy a tipy pro vývojáře her' }}
      </p>
      <div class="mt-6" style="background-color: transparent !important">
        <button
          v-tippy="'Zůstaňte v obraze s nejnovějšími články'"
          class="bg-white text-blue-700 dark:bg-blue-800 dark:text-gray-100 px-6 py-2 rounded-full font-semibold text-lg shadow-lg hover:scale-105 dark:hover:bg-blue-700 transition-all duration-300 animate-pulse border-2 dark:border-blue-600/30"
        >
          <Bell class="w-5 h-5 inline mr-2" />Odebírat
        </button>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section v-if="featured" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ArticleSkeletonCard :pending="featPending" isFeatured :article="featured" :tags="featured.tags" />
      <div class="space-y-6">
        <ArticleSkeletonCard
          v-for="(rec, idx) in recommended"
          :key="rec.id"
          :pending="featPending"
          :article="rec"
          :tags="rec.tags"
          :index="idx"
        />
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section class="bg-gray-100 dark:bg-gray-900 rounded-2xl py-8 px-6">
      <div class="max-w-5xl mx-auto" style="background-color: transparent !important">
        <div class="flex flex-col items-center mb-6 gap-4" style="background-color: transparent !important">
          <h2 class="text-3xl font-bold">Všechny články</h2>
        </div>

        <div class="w-full mb-6" style="background-color: transparent !important">
          <div class="flex flex-col items-center gap-4" style="background-color: transparent !important">
            <div class="w-full max-w-3xl">
              <label for="article-search" class="sr-only">Vyhledat články</label>
              <div class="relative w-full group">
                <span
                  class="absolute inset-y-0 left-4 flex items-center text-gray-400 group-focus-within:text-blue-500 transition-colors"
                >
                  <Icon name="material-symbols:search-rounded" class="w-5 h-5" />
                </span>
                <input
                  id="article-search"
                  v-model="searchQuery"
                  type="search"
                  placeholder="Vyhledat články..."
                  aria-label="Vyhledat články"
                  class="w-full pl-12 pr-10 py-3 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:shadow-lg transition-all duration-200"
                />
                <button
                  v-if="searchQuery"
                  class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Vymazat hledání"
                  @click="searchQuery = ''"
                >
                  <Icon name="material-symbols:close-rounded" class="w-5 h-5" />
                </button>
              </div>
            </div>

            <div class="w-full flex flex-wrap justify-center gap-2" style="background-color: transparent !important">
              <button
                :class="[
                  'flex-shrink-0 text-sm px-3 py-1 rounded-full font-medium transition duration-150 sticky left-0 z-10',
                  selectedTag === ''
                    ? 'bg-blue-500 dark:bg-blue-600 text-white border border-blue-400 dark:border-blue-500'
                    : 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700',
                ]"
                @click="selectedTag = ''"
              >
                Všechny
              </button>
              <button
                v-for="tag in tags"
                :key="tag.id"
                :class="[
                  'flex-shrink-0 text-sm px-3 py-1 rounded-full font-medium transition duration-150',
                  selectedTag === tag.name
                    ? 'bg-blue-500 dark:bg-blue-600 text-white border border-blue-400 dark:border-blue-500'
                    : 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-700',
                ]"
                role="listitem"
                @click="selectedTag = selectedTag === tag.name ? '' : tag.name"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="filteredArticles.length"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          style="background-color: transparent !important"
        >
          <ArticleSkeletonCard
            v-for="(article, idx) in filteredArticles"
            :key="article.id"
            :pending="pending"
            :article="article"
            :tags="article.tags"
            :index="idx"
          />
        </div>

        <p v-else class="text-center text-lg">Žádné články</p>

        <div v-if="hasMore" class="mt-8 text-center" style="background-color: transparent !important">
          <button
            :disabled="pending"
            class="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold text-lg hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700 transition duration-300 disabled:opacity-50"
            @click="loadMore"
          >
            <span v-if="pending" class="animate-spin inline-block mr-2">↻</span>
            Načíst další
          </button>
        </div>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section
      class="text-center bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-2xl py-12 shadow-lg"
    >
      <h3 class="text-2xl font-bold">Přidejte se do diskuze</h3>
      <p class="mt-3 max-w-xl mx-auto text-lg">Zaregistrujte se a sdílejte své názory na herní trendy</p>
      <div class="mt-6 flex justify-center"><AuthForm /></div>
    </section>

    <aside class="lg:col-span-1 lg:order-last space-y-8">
      <div>
        <h3 class="text-xl font-bold mb-4">Nejčtenější</h3>
        <NuxtLink
          v-for="(top, idx) in topArticles"
          :key="top.id"
          :to="`/clanky/${top.slug}`"
          class="block bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-4 flex items-center gap-4 hover:shadow-xl hover:shadow-blue-500/20 dark:hover:shadow-blue-600/20 transition duration-300 group no-underline relative"
        >
          <div
            class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/5 opacity-0 group-hover:opacity-50 transition duration-300 z-10"
          ></div>
          <NuxtImg
            v-if="top.imageUrl"
            :src="top.imageUrl"
            class="w-16 h-16 object-cover rounded-lg group-hover:shadow-md transition duration-500 relative z-20"
            alt="Nejčtenější"
          />
          <div v-else class="w-16 h-16 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg">
            <Icon name="image" class="w-8 h-8 text-gray-400" />
          </div>
          <div class="relative z-20">
            <h4 class="text-base font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition duration-200">
              #{{ idx + 1 }} {{ top.title }}
            </h4>
            <div class="mt-1 text-sm">
              {{ formatDate(top.createdAt ?? undefined) }}
            </div>
          </div>
        </NuxtLink>
      </div>
      <div>
        <h3 class="text-xl font-bold mb-4">Tagy</h3>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            v-for="tag in tags"
            :key="tag.id"
            :to="`/stitky/${tag.slug}`"
            class="bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-95 transition duration-200 no-underline"
          >
            {{ tag.name }}
          </NuxtLink>
        </div>
      </div>
    </aside>
  </main>
</template>

<script setup lang="ts">
import { Bell } from 'lucide-vue-next'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'

import type { ArticleWithDetails } from '../../types/article'

interface ClientSite {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  keywords: string[] | null
}

const slug = 'GameDev'
const page = shallowRef(1)
const limit = shallowRef(15)
const hasMore = shallowRef(true)
const selectedTag = shallowRef('')
const searchQuery = shallowRef('')
const allArticles = ref<ArticleWithDetails[]>([])

const debouncedRefresh = useDebounceFn(() => {
  page.value = 1
  allArticles.value = []
  hasMore.value = true
  refresh()
}, 400)

const articlesUrl = computed(
  () =>
    `/api/articles/by-clientsite/${slug}?page=${page.value}&limit=${limit.value}${selectedTag.value ? `&tag=${encodeURIComponent(selectedTag.value)}` : ''}${searchQuery.value ? `&query=${encodeURIComponent(searchQuery.value)}` : ''}`,
)

const { data: clientSite } = useFetch<ClientSite>(`/api/clients/slug/${slug}`)
const { data: feat, pending: featPending } = useFetch<{
  featured: ArticleWithDetails | null
  recommended: ArticleWithDetails[]
}>(`/api/articles/featured/${slug}`, { default: () => ({ featured: null, recommended: [] }) })
const {
  data: feed,
  refresh,
  pending,
} = useFetch<{ items: ArticleWithDetails[]; hasMore: boolean; tags: { id: string; name: string; slug: string }[] }>(
  articlesUrl,
  {
    default: () => ({ items: [], hasMore: true, tags: [] }),
    watch: false,
  },
)

useSeoMeta({
  title: clientSite.value?.name ?? 'GameDev',
  description: clientSite.value?.description ?? 'Nejnovější trendy a tipy pro vývojáře her',
  keywords: clientSite.value?.keywords?.join(', ') ?? 'gamedev, herní vývoj, trendy, tipy',
  ogTitle: clientSite.value?.name ?? 'GameDev',
  ogDescription:
    clientSite.value?.description ?? 'Nejnovější trendy a tipy pro vývojá gardev, herní vývoj, trendy, tipy',
  ogImage: clientSite.value?.logoUrl ?? '',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

watch(
  feed,
  (d) => {
    const existing = new Set(allArticles.value.map((a) => a.id))
    const next = (d?.items ?? []).filter((a) => !existing.has(a.id))
    allArticles.value = [...allArticles.value, ...next]
    hasMore.value = !!d?.hasMore
  },
  { immediate: true },
)

const loadMore = async () => {
  if (!hasMore.value) return
  page.value++
  await refresh()
}

watch([selectedTag, searchQuery], debouncedRefresh)

const featured = computed(() => feat.value?.featured ?? null)
const recommended = computed(() => feat.value?.recommended ?? [])
const tags = computed(() => feed.value?.tags ?? [])
const topArticles = computed(() =>
  allArticles.value.length
    ? [...allArticles.value].sort((a, b) => (b._count?.reactions ?? 0) - (a._count?.reactions ?? 0)).slice(0, 3)
    : [],
)
const filteredArticles = computed(() => {
  const unique = [...new Map(allArticles.value.map((a) => [a.id, a])).values()].filter(
    (a) => a.id !== featured.value?.id,
  )
  return unique
})
</script>

<style scoped>
@keyframes gradient-x {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
.animate-gradient-x {
  background-size: 200% 100%;
  animation: gradient-x 15s ease-in-out infinite;
}
</style>
