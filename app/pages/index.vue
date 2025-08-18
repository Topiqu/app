<template>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-20">
    <section
      class="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 dark:from-gray-900 dark:via-gray-950 dark:to-black rounded-3xl py-16 px-6 sm:px-10 lg:px-12 text-center shadow-2xl overflow-hidden"
    >
      <div class="absolute inset-0 bg-[url('/pattern.svg')] opacity-10 mix-blend-overlay animate-subtle-pulse"></div>
      <h1 class="relative text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white drop-shadow-xl">
        {{ clientSite?.name ?? 'GameDev' }}
      </h1>
      <p class="relative mt-4 text-lg sm:text-xl text-white/80 max-w-3xl mx-auto font-light">
        Nejnovější trendy a tipy pro vývojáře her
      </p>
      <button
        class="relative mt-8 bg-white text-blue-700 dark:bg-blue-800 dark:text-white px-8 py-3 rounded-full font-semibold text-lg shadow-lg hover:scale-105 hover:shadow-2xl dark:hover:bg-blue-700 transition-all duration-300 ease-out"
      >
        Odebírat novinky
      </button>
    </section>

    <section v-if="featured" class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
      <NuxtLink
        :to="`/clanky/${featured.slug}`"
        class="lg:col-span-2 bg-white dark:bg-gray-800/90 rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 group no-underline"
      >
        <NuxtImg
          v-if="featured.imageUrl"
          :src="featured.imageUrl"
          class="w-full h-64 sm:h-80 lg:h-96 object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          alt="Featured article"
        />
        <div class="p-6 sm:p-8">
          <h2
            class="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200"
          >
            {{ featured.title }}
          </h2>
          <div
            class="mt-4 text-gray-600 dark:text-gray-300 line-clamp-3 sm:line-clamp-4 text-base leading-relaxed"
            v-html="featured.content"
          ></div>
          <div class="mt-6 flex flex-col sm:flex-row justify-between text-sm text-gray-500 dark:text-gray-400 gap-4">
            <span>{{ formatDate(featured.createdAt ?? undefined) }} · {{ featured.readingTime ?? 5 }} min</span>
            <span>{{ featured._count?.comments ?? 0 }} komentářů · {{ featured._count?.reactions ?? 0 }} reakcí</span>
          </div>
          <div class="mt-4 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <NuxtImg
              v-if="featured.user?.avatarUrl"
              :src="featured.user.avatarUrl"
              class="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-600"
              alt="Autorův avatar"
            />
            <span class="font-medium">Autor: {{ featured.user?.username ?? 'Není uveden' }}</span>
          </div>
        </div>
      </NuxtLink>
      <div class="space-y-6">
        <NuxtLink
          v-for="rec in recommended"
          :key="rec.id"
          :to="`/clanky/${rec.slug}`"
          class="block bg-white dark:bg-gray-800/90 rounded-2xl shadow-lg p-5 hover:shadow-xl transition-all duration-300 group no-underline"
        >
          <NuxtImg
            v-if="rec.imageUrl"
            :src="rec.imageUrl"
            class="w-full h-32 sm:h-36 lg:h-40 object-cover rounded-lg mb-4 group-hover:scale-105 transition-transform duration-500 ease-out"
            alt="Doporučený článek"
          />
          <h3
            class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200"
          >
            {{ rec.title }}
          </h3>
          <div class="mt-3 flex flex-col sm:flex-row justify-between text-sm text-gray-500 dark:text-gray-400 gap-3">
            <span>{{ formatDate(rec.createdAt ?? undefined) }}</span>
            <span>{{ rec._count?.comments ?? 0 }} komentářů</span>
          </div>
          <div class="mt-3 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <NuxtImg
              v-if="rec.user?.avatarUrl"
              :src="rec.user.avatarUrl"
              class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-600"
              alt="Autorův avatar"
            />
            <span class="font-medium">Autor: {{ rec.user?.username ?? 'Není uveden' }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section>
      <div class="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Všechny články</h2>
        <select
          v-model="selectedTag"
          class="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition w-full sm:w-auto"
        >
          <option value="">Všechny tagy</option>
          <option v-for="tag in tags" :key="tag.tag.id" :value="tag.tag.name">{{ tag.tag.name }}</option>
        </select>
      </div>
      <div v-if="filteredArticles.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        <NuxtLink
          v-for="article in filteredArticles"
          :key="article.id"
          :to="`/clanky/${article.slug}`"
          class="bg-white dark:bg-gray-800/90 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-5 hover:shadow-xl transition-all duration-300 group no-underline"
        >
          <NuxtImg
            v-if="article.imageUrl"
            :src="article.imageUrl"
            class="w-full h-48 sm:h-56 object-cover rounded-xl mb-5 group-hover:scale-105 transition-transform duration-500 ease-out"
            alt="Náhled článku"
          />
          <h3
            class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200"
          >
            {{ article.title }}
          </h3>
          <div class="flex flex-wrap gap-2 mt-3">
            <span
              v-for="tag in article.tags.slice(0, 3)"
              :key="tag.tag.id"
              class="text-xs bg-blue-100 dark:bg-blue-900/80 text-blue-600 dark:text-blue-300 px-2.5 py-1 rounded-full font-medium"
              >{{ tag.tag.name }}</span
            >
            <span v-if="article.tags.length > 3" class="text-xs text-gray-500 dark:text-gray-400">...</span>
          </div>
          <div class="flex flex-col sm:flex-row justify-between mt-3 text-sm text-gray-500 dark:text-gray-400 gap-3">
            <span>{{ formatDate(article.createdAt ?? undefined) }}</span>
            <span v-if="article.readingTime">{{ article.readingTime }} min</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <div class="flex items-center gap-3">
              <NuxtImg
                v-if="article.user?.avatarUrl"
                :src="article.user.avatarUrl"
                class="w-7 h-7 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                alt="Autorův avatar"
              />
              <span class="font-medium">Autor: {{ article.user?.username ?? 'Není uveden' }}</span>
            </div>
            <span>{{ article._count?.comments ?? 0 }} komentářů</span>
          </div>
        </NuxtLink>
      </div>
      <p v-else class="text-gray-600 dark:text-gray-400 text-center text-lg">Žádné články k zobrazení.</p>
    </section>

    <section
      class="text-center bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-900/90 dark:to-gray-800/90 rounded-3xl py-16 shadow-xl"
    >
      <h3 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Přidejte se do diskuze</h3>
      <p class="mt-4 text-gray-600 dark:text-gray-300 max-w-xl mx-auto text-lg font-light">
        Zaregistrujte se a sdílejte své názory na nejnovější herní trendy.
      </p>
      <div class="mt-8">
        <AuthForm />
      </div>
    </section>

    <aside class="space-y-10">
      <div>
        <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-5">Nejčtenější</h3>
        <NuxtLink
          v-for="top in topArticles"
          :key="top.id"
          :to="`/clanky/${top.slug}`"
          class="block mb-4 text-base text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 no-underline"
          >{{ top.title }}</NuxtLink
        >
      </div>
      <div>
        <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-5">Tagy</h3>
        <div class="flex flex-wrap gap-3">
          <NuxtLink
            v-for="tag in tags"
            :key="tag.tag.id"
            :to="`/stitky/${tag.tag.slug}`"
            class="text-sm bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 no-underline"
            >{{ tag.tag.name }}</NuxtLink
          >
        </div>
      </div>
    </aside>
  </main>
</template>

<script setup lang="ts">
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
const tags = computed(() => (articles.value.length ? Array.from(new Set(articles.value.flatMap((a) => a.tags))) : []))
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
  if (!selectedTag.value) return articles.value.filter((a) => a.id !== featured.value?.id).slice(2)
  return articles.value
    .filter((a) => a.id !== featured.value?.id && a.tags.some((t) => t.tag.name === selectedTag.value))
    .slice(2)
})
</script>

<style scoped>
@keyframes subtle-pulse {
  0%,
  100% {
    opacity: 0.1;
  }
  50% {
    opacity: 0.15;
  }
}
.animate-subtle-pulse {
  animation: subtle-pulse 8s ease-in-out infinite;
}
</style>
