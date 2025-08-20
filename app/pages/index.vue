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
      <NuxtLink
        v-motion
        :initial="{ opacity: 0, y: 50 }"
        :visibleOnce="{ opacity: 1, y: 0, transition: { duration: 500 } }"
        :to="`/clanky/${featured.slug}`"
        class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 group no-underline relative"
      >
        <div
          class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/5 opacity-0 group-hover:opacity-50 transition duration-300 z-10"
        ></div>
        <NuxtImg
          v-if="featured.imageUrl"
          :src="featured.imageUrl"
          class="w-full h-64 lg:h-80 object-cover group-hover:scale-[1.02] group-hover:rotate-1 transition duration-500 relative z-20"
          alt="Featured"
        />
        <div v-else class="w-full h-64 lg:h-80 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Icon name="image" class="w-16 h-16 text-gray-400" />
        </div>
        <div class="p-6 relative z-20">
          <h2
            class="text-xl lg:text-2xl font-bold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
          >
            {{ featured.title }}
          </h2>
          <div class="mt-3 line-clamp-3 text-base" v-html="featured.content"></div>
          <div class="mt-4 flex flex-col sm:flex-row justify-between text-sm gap-3">
            <span>{{ formatDate(featured.createdAt ?? undefined) }} · {{ featured.readingTime ?? 5 }} min čtení</span>
            <span v-tippy="'Komentáře a reakce'">
              <MessageCircle class="w-4 h-4 inline mr-1" />{{ featured._count?.comments ?? 0 }} ·
              <Heart class="w-4 h-4 inline mr-1" />{{ featured._count?.reactions ?? 0 }}
            </span>
          </div>
          <div class="mt-3 flex items-center gap-3 text-sm">
            <NuxtImg
              v-if="featured.user?.avatarUrl"
              :src="featured.user.avatarUrl"
              class="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700 relative z-20"
              alt="Autor"
            />
            <span class="font-medium">{{ featured.user?.username ?? 'Není uveden' }}</span>
          </div>
        </div>
      </NuxtLink>
      <div class="space-y-6">
        <NuxtLink
          v-for="(rec, idx) in recommended"
          :key="rec.id"
          v-motion
          :initial="{ opacity: 0, y: 50 }"
          :visibleOnce="{ opacity: 1, y: 0, transition: { duration: 500, delay: 100 * idx } }"
          :to="`/clanky/${rec.slug}`"
          class="block bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 hover:shadow-xl hover:shadow-blue-500/20 dark:hover:shadow-blue-600/20 transition duration-300 group no-underline relative"
        >
          <div
            class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/5 opacity-0 group-hover:opacity-50 transition duration-300 z-10"
          ></div>
          <NuxtImg
            v-if="rec.imageUrl"
            :src="rec.imageUrl"
            class="w-full h-36 object-cover rounded-lg mb-4 group-hover:blur-[1px] transition duration-500 relative z-20"
            alt="Doporučený"
          />
          <div v-else class="w-full h-36 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg mb-4">
            <Icon name="image" class="w-12 h-12 text-gray-400" />
          </div>
          <h3
            class="text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200 relative z-20"
          >
            {{ rec.title }}
          </h3>
          <div
            class="mt-2 truncate text-sm text-gray-600 dark:text-gray-300"
            v-html="rec.content?.substring(0, 50) + (rec.content?.length! > 50 ? '...' : '')"
          ></div>
          <div class="mt-3 flex flex-col sm:flex-row justify-between text-sm gap-3 relative z-20">
            <span>{{ formatDate(rec.createdAt ?? undefined) }} · {{ rec.readingTime ?? 5 }} min čtení</span>
            <span v-tippy="'Komentáře'">
              <MessageCircle class="w-4 h-4 inline mr-1" />{{ rec._count?.comments ?? 0 }}
            </span>
          </div>
          <div class="mt-3 flex items-center gap-3 text-sm relative z-20">
            <NuxtImg
              v-if="rec.user?.avatarUrl"
              :src="rec.user.avatarUrl"
              class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700 transition duration-300 relative z-20"
              alt="Autor"
            />
            <span
              class="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
              >{{ rec.user?.username ?? 'Není uveden' }}</span
            >
          </div>
        </NuxtLink>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section class="bg-gray-100 dark:bg-gray-900 rounded-2xl py-8 px-6">
      <div
        class="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4"
        style="background-color: transparent !important"
      >
        <h2 class="text-3xl font-bold">Všechny články</h2>
        <div class="flex flex-wrap gap-2 w-full sm:w-auto" style="background-color: transparent !important">
          <button
            v-for="tag in tags"
            :key="tag.id"
            :class="[
              'text-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full font-medium transition duration-200 hover:scale-95',
              selectedTag === tag.name
                ? 'bg-blue-500 dark:bg-blue-600 text-white border border-blue-400 dark:border-blue-500'
                : 'hover:bg-blue-200 dark:hover:bg-blue-800',
            ]"
            @click="selectedTag = tag.name"
          >
            <span v-if="selectedTag === tag.name" class="mr-1">✓</span>{{ tag.name }}
          </button>
          <button
            :class="[
              'text-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full font-medium transition duration-200 hover:scale-95',
              selectedTag === ''
                ? 'bg-blue-500 dark:bg-blue-600 text-white border border-blue-400 dark:border-blue-500'
                : 'hover:bg-blue-200 dark:hover:bg-blue-800',
            ]"
            @click="selectedTag = ''"
          >
            <span v-if="selectedTag === ''" class="mr-1">✓</span>Všechny
          </button>
          <select
            v-model="selectedTag"
            class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-full px-4 py-1.5 text-sm font-medium transition w-full sm:w-auto sm:hidden"
          >
            <option value="">Všechny tagy</option>
            <option v-for="tag in tags" :key="tag.id" :value="tag.name">{{ tag.name }}</option>
          </select>
        </div>
      </div>
      <div
        v-if="filteredArticles.length"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        style="background-color: transparent !important"
      >
        <NuxtLink
          v-for="(article, idx) in filteredArticles"
          :key="article.id"
          v-motion
          :initial="{ opacity: 0, y: 50 }"
          :visibleOnce="{ opacity: 1, y: 0, transition: { duration: 500, delay: 100 * idx } }"
          :to="`/clanky/${article.slug}`"
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 hover:shadow-xl hover:shadow-blue-500/20 dark:hover:shadow-blue-600/20 transition duration-300 group no-underline relative"
        >
          <div
            class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/5 opacity-0 group-hover:opacity-50 transition duration-300 z-10"
          ></div>
          <NuxtImg
            v-if="article.imageUrl"
            :src="article.imageUrl"
            class="w-full h-48 object-cover rounded-lg mb-4 transition duration-500 relative z-20"
            alt="Náhled"
          />
          <div v-else class="w-full h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg mb-4">
            <Icon name="image" class="w-12 h-12 text-gray-400" />
          </div>
          <h3
            class="text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200 relative z-20"
          >
            {{ article.title }}
          </h3>
          <div class="flex flex-wrap gap-2 mt-3 relative z-20">
            <button
              v-for="tag in article.tags.slice(0, 3)"
              :key="tag.tag.id"
              class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-800 hover:scale-95 transition duration-200"
              @click.stop="selectedTag = tag.tag.name"
            >
              {{ tag.tag.name }}
            </button>
            <span v-if="article.tags.length > 3" class="text-xs">...</span>
          </div>
          <div class="mt-3 flex flex-col sm:flex-row justify-between text-sm gap-3 relative z-20">
            <span>{{ formatDate(article.createdAt ?? undefined) }}</span>
            <span v-if="article.readingTime">{{ article.readingTime }} min</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-sm relative z-20">
            <div class="flex items-center gap-3">
              <NuxtImg
                v-if="article.user?.avatarUrl"
                :src="article.user.avatarUrl"
                class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700 relative z-20"
                alt="Autor"
              />
              <span class="font-medium">{{ article.user?.username ?? 'Není uveden' }}</span>
            </div>
            <span v-tippy="'Komentáře'"
              ><MessageCircle class="w-4 h-4 inline mr-1" />{{ article._count?.comments ?? 0 }}</span
            >
          </div>
        </NuxtLink>
      </div>
      <p v-else class="text-center text-lg">Žádné články</p>
      <div v-if="hasMore" class="mt-8 text-center">
        <button
          :disabled="pending"
          class="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold text-lg hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-700 transition duration-300 disabled:opacity-50"
          @click="loadMore"
        >
          <span v-if="pending" class="animate-spin inline-block mr-2">↻</span>
          Načíst další
        </button>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section
      class="text-center bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-2xl py-12 shadow-lg"
    >
      <h3 class="text-2xl font-bold">Přidejte se do diskuze</h3>
      <p class="mt-3 max-w-xl mx-auto text-lg">Zaregistrujte se a sdílejte své názory na herní trendy</p>
      <div class="mt-6"><AuthForm /></div>
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
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import { Bell, MessageCircle, Heart } from 'lucide-vue-next'

interface User {
  id: string
  username: string
  email: string
  avatarUrl: string | null
}
interface Tag {
  id: string
  name: string
  slug: string
}
interface ArticleTag {
  tag: Tag
}
interface Article {
  id: string
  slug: string
  title: string
  content: string | null
  imageUrl: string | null
  createdAt: string
  readingTime: number
  user: User | null
  tags: ArticleTag[]
  _count: { comments: number; reactions: number } | null
}
interface ClientSite {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  keywords: string[] | null
}

const slug = 'GameDev'
const page = shallowRef(1)
const limit = shallowRef(2)
const hasMore = shallowRef(true)
const selectedTag = shallowRef('')
const allArticles = ref<Article[]>([])

const articlesUrl = computed(
  () =>
    `/api/articles/by-clientsite/${slug}?page=${page.value}&limit=${limit.value}${selectedTag.value ? `&tag=${selectedTag.value}` : ''}`,
)
const { data: clientSite } = useFetch<ClientSite>(`/api/clients/slug/${slug}`)
const { data: feat } = useFetch<{ featured: Article | null; recommended: Article[] }>(
  `/api/articles/featured/${slug}`,
  { default: () => ({ featured: null, recommended: [] }) },
)
const {
  data: feed,
  refresh,
  pending,
} = useFetch<{ items: Article[]; hasMore: boolean }>(articlesUrl, { default: () => ({ items: [], hasMore: true }) })

useSeoMeta({
  title: clientSite.value?.name ?? 'GameDev',
  description: clientSite.value?.description ?? 'Nejnovější trendy a tipy pro vývojáře her',
  keywords: clientSite.value?.keywords?.join(', ') ?? 'gamedev, herní vývoj, trendy, tipy',
  ogTitle: clientSite.value?.name ?? 'GameDev',
  ogDescription: clientSite.value?.description ?? 'Nejnovější trendy a tipy pro vývojáře her',
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

watch(selectedTag, () => {
  page.value = 1
  allArticles.value = []
  hasMore.value = true
  refresh()
})

const featured = computed(() => feat.value?.featured ?? null)
const recommended = computed(() => feat.value?.recommended ?? [])
const tags = computed(() => {
  if (!allArticles.value.length) return []
  const t = new Map<string, { id: string; name: string; slug: string; count: number }>()
  allArticles.value
    .flatMap((a) => a.tags)
    .forEach((x) => {
      if (!t.has(x.tag.id)) t.set(x.tag.id, { id: x.tag.id, name: x.tag.name, slug: x.tag.slug, count: 0 })
      t.get(x.tag.id)!.count++
    })
  return [...t.values()].sort((a, b) => b.count - a.count)
})
const topArticles = computed(() =>
  allArticles.value.length
    ? [...allArticles.value].sort((a, b) => (b._count?.reactions ?? 0) - (a._count?.reactions ?? 0)).slice(0, 3)
    : [],
)
const filteredArticles = computed(() => {
  const unique = [...new Map(allArticles.value.map((a) => [a.id, a])).values()].filter(
    (a) => a.id !== featured.value?.id,
  )
  return selectedTag.value
    ? unique.filter((a) => a.tags.some((t) => t.tag.name.toLowerCase() === selectedTag.value.toLowerCase()))
    : unique
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
