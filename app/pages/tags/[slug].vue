<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-100 to-white p-6">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <NuxtLink
        to="/"
        class="group inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-lg transition duration-300 no-underline"
        aria-label="Zpět na seznam článků"
      >
        <Icon name="mdi:arrow-left" class="w-5 h-5 mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
        Zpět na seznam
      </NuxtLink>

      <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900">
        Články se štítkem: <span class="text-blue-500">{{ tagName }}</span>
      </h1>

      <div class="flex flex-col gap-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <input
            v-model="search"
            placeholder="Hledat články..."
            class="w-full sm:max-w-md px-5 py-3 rounded-xl border border-gray-300 bg-white shadow focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          />
          <select
            v-model="sort"
            class="px-5 py-3 rounded-xl border border-gray-300 bg-white shadow focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          >
            <option value="createdAt:desc">Nejnovější</option>
            <option value="createdAt:asc">Nejstarší</option>
            <option value="title:asc">Název A-Z</option>
            <option value="title:desc">Název Z-A</option>
          </select>
        </div>

        <div v-if="filteredArticles.length" class="grid gap-6">
          <div
            v-for="a in filteredArticles"
            :key="a.articleId"
            class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300"
          >
            <NuxtLink
              :to="`/articles/${a.article.slug}`"
              class="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 p-6 no-underline group"
            >
              <NuxtImg
                v-if="a.article.imageUrl"
                :src="a.article.imageUrl"
                :alt="`Titulní obrázek k článku: ${a.article.title}`"
                format="webp"
                quality="80"
                width="160"
                height="100"
                class="rounded-xl border border-gray-100 shadow-sm object-cover w-full sm:w-48 h-[120px]"
              />
              <div class="flex flex-col justify-between gap-3 flex-1">
                <div class="flex flex-col gap-1">
                  <h2 class="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition">
                    {{ a.article.title }}
                  </h2>
                  <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                    <template v-if="data?.user">
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium"
                      >
                        <Icon
                          :name="a.article.status === 'draft' ? 'mdi:pencil-outline' : 'mdi:check-circle-outline'"
                          class="w-4 h-4"
                        />
                        {{ a.article.status === 'draft' ? 'Návrh' : 'Publikováno' }}
                      </span>
                      <span>•</span>
                    </template>
                    <span class="inline-flex items-center gap-1">
                      <Icon name="mdi:calendar" class="w-4 h-4 text-gray-400" />
                      {{ formatDate(a.article.createdAt.toString()) }}
                    </span>
                    <span>•</span>
                    <span class="inline-flex items-center gap-1 text-blue-500 font-medium">
                      <Icon name="mdi:account-outline" class="w-4 h-4" />
                      {{ a.article.user.username }}
                    </span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <p v-else class="text-gray-500 italic text-center py-8">Žádné články s tímto tagem nebyly nalezeny.</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Article as _Article } from '@zenstackhq/runtime/models'

import { format } from 'date-fns'
import { useRoute } from 'vue-router'

type Article = {
  articleId: string
  tagId: string
  article: _Article & {
    user: { username: string }
    tags: {
      articleId: string
      tagId: string
      tag: { name: string; slug: string }
    }[]
  }
}

type TagResponse = {
  id: string
  name: string
  slug: string
  articles: Article[]
}

const { data } = useAuth()
const route = useRoute()
const tagSlug = computed(() => route.params.slug as string)
const search = ref('')
const sort = ref('createdAt:desc')

const { data: tag } = await useFetch<TagResponse>(`/api/tags/slug/${tagSlug.value}`, {
  default: () => ({ id: '', name: 'Neznámý tag', slug: '', articles: [] }),
})
const tagName = computed(() => tag.value.name)

const filteredArticles = computed(() => {
  const result = tag.value.articles.filter((a) => a.article.title.toLowerCase().includes(search.value.toLowerCase()))

  const [field, order] = sort.value.split(':')
  result.sort((a, b) => {
    if (field === 'createdAt') {
      return order === 'asc'
        ? new Date(a.article.createdAt).getTime() - new Date(b.article.createdAt).getTime()
        : new Date(b.article.createdAt).getTime() - new Date(a.article.createdAt).getTime()
    } else {
      return order === 'asc'
        ? a.article.title.localeCompare(b.article.title)
        : b.article.title.localeCompare(a.article.title)
    }
  })

  return result
})

const formatDate = (date: string) => format(new Date(date), 'dd.MM.yyyy, HH:mm')

useSeoMeta({
  title: () => `Články s tagem: ${tagName.value}`,
  description: () => `Seznam článků označených tagem ${tagName.value}.`,
  ogTitle: () => `Články s tagem: ${tagName.value}`,
  ogDescription: () => `Seznam článků označených tagem ${tagName.value}.`,
  twitterCard: 'summary',
})
</script>
