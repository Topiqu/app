<template>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
    <section
      class="relative bg-gradient-to-r from-blue-600 to-indigo-900 dark:from-gray-900 dark:to-black rounded-3xl py-12 px-6 text-center shadow-xl overflow-hidden animate-gradient-x"
    >
      <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 dark:to-gray-900/10"></div>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white drop-shadow">
        {{ clientSite?.name ?? 'GameDev' }}
      </h1>
      <p class="mt-4 text-lg sm:text-xl text-white/80 max-w-3xl mx-auto">Nejnovější trendy a tipy pro vývojáře her</p>
      <button
        class="mt-6 bg-white text-blue-700 dark:bg-blue-800 dark:text-gray-100 px-6 py-2 rounded-full font-semibold text-lg shadow-lg hover:scale-105 dark:hover:bg-blue-700 transition-all duration-300 animate-pulse border-2 dark:border-blue-600/30"
      >
        <Bell class="w-5 h-5 inline mr-2" />Odebírat
      </button>
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
          class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/20 opacity-0 group-hover:opacity-100 transition duration-300"
        ></div>
        <NuxtImg
          v-if="featured.imageUrl"
          :src="featured.imageUrl"
          class="w-full h-64 lg:h-80 object-cover group-hover:scale-105 group-hover:rotate-1 transition duration-500"
          alt="Featured"
        />
        <div class="p-6">
          <h2
            class="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
          >
            {{ featured.title }}
          </h2>
          <div class="mt-3 line-clamp-3 text-base" v-html="featured.content"></div>
          <div class="mt-4 flex flex-col sm:flex-row justify-between text-sm text-gray-500 dark:text-gray-400 gap-3">
            <span>{{ formatDate(featured.createdAt ?? undefined) }} · {{ featured.readingTime ?? 5 }} min</span>
            <span>
              <MessageCircle class="w-4 h-4 inline mr-1" />{{ featured._count?.comments ?? 0 }} ·
              <Heart class="w-4 h-4 inline mr-1" />{{ featured._count?.reactions ?? 0 }}
            </span>
          </div>
          <div class="mt-3 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <NuxtImg
              v-if="featured.user?.avatarUrl"
              :src="featured.user.avatarUrl"
              class="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
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
          class="block bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-5 hover:shadow-xl transition duration-300 group no-underline relative"
        >
          <div
            class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/20 opacity-0 group-hover:opacity-100 transition duration-300"
          ></div>
          <NuxtImg
            v-if="rec.imageUrl"
            :src="rec.imageUrl"
            class="w-full h-36 object-cover rounded-lg mb-4 group-hover:scale-105 group-hover:rotate-1 transition duration-500"
            alt="Doporučený"
          />
          <h3
            class="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
          >
            {{ rec.title }}
          </h3>
          <div class="mt-3 flex flex-col sm:flex-row justify-between text-sm text-gray-500 dark:text-gray-400 gap-3">
            <span>{{ formatDate(rec.createdAt ?? undefined) }}</span>
            <span><MessageCircle class="w-4 h-4 inline mr-1" />{{ rec._count?.comments ?? 0 }}</span>
          </div>
          <div class="mt-3 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <NuxtImg
              v-if="rec.user?.avatarUrl"
              :src="rec.user.avatarUrl"
              class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700"
              alt="Autor"
            />
            <span class="font-medium">{{ rec.user?.username ?? 'Není uveden' }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section class="bg-gray-100 dark:bg-gray-900 rounded-2xl py-8 px-6">
      <div class="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Všechny články</h2>
        <div class="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            v-for="tag in tags"
            :key="tag.id"
            :class="[
              'text-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full font-medium transition duration-200',
              selectedTag === tag.name
                ? 'bg-blue-500 dark:bg-blue-600 text-white'
                : 'hover:bg-blue-200 dark:hover:bg-blue-800',
            ]"
            @click="selectedTag = tag.name"
          >
            {{ tag.name }}
          </button>
          <button
            :class="[
              'text-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full font-medium transition duration-200',
              selectedTag === ''
                ? 'bg-blue-500 dark:bg-blue-600 text-white'
                : 'hover:bg-blue-200 dark:hover:bg-blue-800',
            ]"
            @click="selectedTag = ''"
          >
            Všechny
          </button>
          <select
            v-model="selectedTag"
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-1.5 text-sm font-medium transition w-full sm:w-auto sm:hidden"
          >
            <option value="">Všechny tagy</option>
            <option v-for="tag in tags" :key="tag.id" :value="tag.name">{{ tag.name }}</option>
          </select>
        </div>
      </div>
      <div v-if="filteredArticles.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
            class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/20 opacity-0 group-hover:opacity-100 transition duration-300"
          ></div>
          <NuxtImg
            v-if="article.imageUrl"
            :src="article.imageUrl"
            class="w-full h-48 object-cover rounded-lg mb-4 group-hover:scale-105 group-hover:rotate-1 transition duration-500"
            alt="Náhled"
          />
          <h3
            class="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
          >
            {{ article.title }}
          </h3>
          <div class="flex flex-wrap gap-2 mt-3">
            <button
              v-for="tag in article.tags.slice(0, 3)"
              :key="tag.tag.id"
              class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition duration-200"
              @click.stop="selectedTag = tag.tag.name"
            >
              {{ tag.tag.name }}
            </button>
            <span v-if="article.tags.length > 3" class="text-xs text-gray-500 dark:text-gray-400">...</span>
          </div>
          <div class="mt-3 flex flex-col sm:flex-row justify-between text-sm text-gray-500 dark:text-gray-400 gap-3">
            <span>{{ formatDate(article.createdAt ?? undefined) }}</span>
            <span v-if="article.readingTime">{{ article.readingTime }} min</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <div class="flex items-center gap-3">
              <NuxtImg
                v-if="article.user?.avatarUrl"
                :src="article.user.avatarUrl"
                class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                alt="Autor"
              />
              <span class="font-medium">{{ article.user?.username ?? 'Není uveden' }}</span>
            </div>
            <span><MessageCircle class="w-4 h-4 inline mr-1" />{{ article._count?.comments ?? 0 }}</span>
          </div>
        </NuxtLink>
      </div>
      <p v-else class="text-gray-600 dark:text-gray-400 text-center text-lg">Žádné články</p>
    </section>

    <hr class="border-gray-200 dark:border-gray-800 my-8" />

    <section
      class="text-center bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 rounded-2xl py-12 shadow-lg"
    >
      <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Přidejte se do diskuze</h3>
      <p class="mt-3 text-gray-600 dark:text-gray-300 max-w-xl mx-auto text-lg">
        Zaregistrujte se a sdílejte své názory na herní trendy
      </p>
      <div class="mt-6"><AuthForm /></div>
    </section>

    <aside class="space-y-8">
      <div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Nejčtenější</h3>
        <NuxtLink
          v-for="top in topArticles"
          :key="top.id"
          :to="`/clanky/${top.slug}`"
          class="block bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 mb-4 flex items-center gap-4 hover:shadow-xl hover:shadow-blue-500/20 dark:hover:shadow-blue-600/20 transition duration-300 no-underline"
        >
          <NuxtImg
            v-if="top.imageUrl"
            :src="top.imageUrl"
            class="w-16 h-16 object-cover rounded-lg"
            alt="Nejčtenější"
          />
          <div>
            <h4
              class="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200"
            >
              {{ top.title }}
            </h4>
            <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ formatDate(top.createdAt ?? undefined) }}
            </div>
          </div>
        </NuxtLink>
      </div>
      <div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Tagy</h3>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            v-for="tag in tags"
            :key="tag.id"
            :to="`/stitky/${tag.slug}`"
            :style="{ fontSize: `${0.9 + (tag.count || 1) * 0.1}rem` }"
            class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200 no-underline"
          >
            {{ tag.name }}
          </NuxtLink>
        </div>
      </div>
    </aside>
  </main>
</template>

<script setup lang="ts">
import { Bell, MessageCircle, Heart } from 'lucide-vue-next'

const slug = 'GameDev'
const { data: clientSite } = await useFetch(`/api/clients/slug/${slug}`, {
  default: () => ({ id: '', name: 'GameDev' }),
})
const { data: articles } = await useFetch(`/api/articles/by-clientsite/${slug}`, { default: () => [] })

const featured = computed(() =>
  articles.value.length
    ? articles.value.reduce((a, b) =>
        a._count.reactions + a._count.comments > b._count.reactions + b._count.comments ? a : b,
      )
    : null,
)
const recommended = computed(() =>
  articles.value.length ? articles.value.filter((a) => a.id !== featured.value?.id).slice(0, 2) : [],
)
const tags = computed(() => {
  if (!articles.value.length) return []
  const t = new Map()
  articles.value
    .flatMap((a) => a.tags)
    .forEach((x) => {
      if (!t.has(x.tag.id)) t.set(x.tag.id, { id: x.tag.id, name: x.tag.name, slug: x.tag.slug, count: 0 })
      t.get(x.tag.id).count += 1
    })
  return Array.from(t.values()).sort((a, b) => b.count - a.count)
})
const topArticles = computed(() =>
  articles.value.length
    ? articles.value
        .slice()
        .sort((a, b) => b._count.reactions - a._count.reactions)
        .slice(0, 3)
    : [],
)
const selectedTag = shallowRef('')
const filteredArticles = computed(() => {
  const f = articles.value.filter((a) => a.id !== featured.value?.id)
  return selectedTag.value
    ? f.filter((a) => a.tags.some((t) => t.tag.name.toLowerCase() === selectedTag.value.toLowerCase()))
    : f
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
