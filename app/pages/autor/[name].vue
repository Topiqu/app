<template>
  <div class="min-h-screen bg-gradient-to-br">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <Back />
      <div class="text-center">
        <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Články autora:
          <span class="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {{ authorName }}
          </span>
        </h1>
        <div class="flex flex-col items-center mt-4 gap-2">
          <NuxtImg
            v-if="author.avatarUrl"
            :src="author.avatarUrl"
            alt="Avatar autora"
            class="w-16 h-16 rounded-full border border-gray-200 dark:border-neutral-700 object-cover"
          />
          <p v-if="author.bio" class="text-gray-600 dark:text-gray-400 max-w-lg">
            {{ author.bio }}
          </p>
        </div>
      </div>

      <div
        class="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-neutral-700 sm:flex-row sm:justify-between sm:items-center"
      >
        <input
          v-model="search"
          placeholder="Hledat články..."
          class="w-full px-5 py-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
        />
        <select
          v-model="sort"
          class="px-5 py-3 rounded-xl border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
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
          class="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
        >
          <NuxtLink
            :to="`/clanky/${a.article.slug}`"
            class="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 p-6 no-underline group"
          >
            <div class="relative">
              <NuxtImg
                v-if="a.article.imageUrl"
                :src="a.article.imageUrl"
                :alt="`Titulní obrázek k článku: ${a.article.title}`"
                format="webp"
                quality="80"
                width="160"
                height="100"
                class="rounded-xl border border-gray-100 dark:border-neutral-800 shadow-sm object-cover w-full sm:w-48 h-[120px] group-hover:brightness-105 transition"
              />
              <div
                v-else
                class="w-full sm:w-48 h-[120px] rounded-xl border border-gray-100 dark:border-neutral-800 flex items-center justify-center bg-gray-50 dark:bg-neutral-800 text-gray-400"
              >
                <Icon name="mdi:image-off" class="w-8 h-8" />
              </div>
            </div>

            <div class="flex flex-col justify-between gap-3 flex-1">
              <div class="flex flex-col gap-2">
                <h2
                  class="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight"
                >
                  {{ a.article.title }}
                </h2>

                <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 pt-1">
                  <div v-if="auth?.user.role === 'admin' || auth?.user.role === 'superadmin'">
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-medium"
                    >
                      <Icon
                        :name="a.article.status === 'draft' ? 'mdi:pencil-outline' : 'mdi:check-circle-outline'"
                        class="w-4 h-4"
                      />
                      {{ a.article.status === 'draft' ? 'Návrh' : 'Publikováno' }}
                    </span>
                    <span>•</span>
                  </div>

                  <span class="inline-flex items-center gap-1">
                    <Icon name="mdi:calendar" class="w-4 h-4 text-gray-400" />
                    {{ formatDate(a.article.createdAt.toString()) }}
                  </span>
                  <span>•</span>
                  <span class="inline-flex items-center gap-1 text-blue-500 dark:text-blue-400 font-medium">
                    <Icon name="mdi:account-outline" class="w-4 h-4" />
                    {{ a.article.user.username }}
                  </span>
                  <span>•</span>
                  <span class="inline-flex items-center gap-1">
                    <Icon
                      name="mdi:eye"
                      class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition"
                    />
                    {{ a.article.views }} zhlédnutí
                  </span>
                  <span>•</span>
                  <span class="inline-flex items-center gap-1 group-hover:text-red-500 transition">
                    <Icon name="mdi:heart" class="w-4 h-4 text-gray-400 group-hover:scale-110 transition" />
                    {{ a.article.likes }}
                  </span>
                </div>
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>

      <p v-else class="text-gray-500 dark:text-gray-400 italic text-center py-8 text-lg">
        Tento autor zatím nemá žádné články.
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Article as _Article } from '@zenstackhq/runtime/models'

import { formatDate } from '~~/shared/utils'

type Article = {
  articleId: string
  article: _Article & {
    user: { username: string }
    tags: {
      articleId: string
      tagId: string
      tag: { name: string; slug: string }
    }[]
    views: number
    likes: number
  }
}

type AuthorResponse = {
  id: string
  username: string
  avatarUrl?: string
  bio?: string
  articles: Article[]
}

const route = useRoute()
const { data: auth } = useAuth()
const username = computed(() => route.params.name)

const search = shallowRef<string>('')
const sort = shallowRef<string>('createdAt:desc')

const { data: author } = await useFetch<AuthorResponse>(`/api/articles/${username.value}/by-author`, {
  default: () => ({ id: '', username: 'Neznámý autor', articles: [] }),
})

const authorName = computed(() => author.value.username)

const filteredArticles = computed(() => {
  const result = author.value.articles.filter((a) => a.article.title.toLowerCase().includes(search.value.toLowerCase()))
  const [field, order] = sort.value.split(':')
  result.sort((a, b) =>
    field === 'createdAt'
      ? order === 'asc'
        ? new Date(a.article.createdAt).getTime() - new Date(b.article.createdAt).getTime()
        : new Date(b.article.createdAt).getTime() - new Date(a.article.createdAt).getTime()
      : order === 'asc'
        ? a.article.title.localeCompare(b.article.title)
        : b.article.title.localeCompare(a.article.title),
  )
  return result
})

useSeoMeta({
  title: () => `Články autora: ${authorName.value}`,
  description: () => `Seznam článků, které napsal autor ${authorName.value}.`,
  ogTitle: () => `Články autora: ${authorName.value}`,
  ogDescription: () => `Seznam článků, které napsal autor ${authorName.value}.`,
  twitterCard: 'summary',
})
</script>
