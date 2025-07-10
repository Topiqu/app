<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
    <div class="max-w-3xl mx-auto flex flex-col gap-6 px-2 sm:px-0">
      <NuxtLink
        to="/"
        class="group inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 ease-in-out"
        aria-label="Zpět na seznam článků"
      >
        <Icon
          name="mdi:arrow-left"
          class="w-6 h-6 mr-2 transition-transform duration-300 group-hover:-translate-x-1.5"
        />
        Zpět na seznam
      </NuxtLink>

      <h1 class="text-3xl md:text-4xl font-bold text-gray-900">
        Články s tagem: {{ tagName }}
      </h1>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-4">
          <input
            v-model="search"
            placeholder="Hledat články..."
            class="p-4 rounded-2xl text-base w-full max-w-md border-b-2 focus:outline-none focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          />
          <select
            v-model="sort"
            class="p-4 rounded-2xl text-base border-b-2 focus:outline-none focus:ring-2 focus:border-blue-500/70 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <option value="createdAt:desc">Nejnovější</option>
            <option value="createdAt:asc">Nejstarší</option>
            <option value="title:asc">Název A-Z</option>
            <option value="title:desc">Název Z-A</option>
          </select>
        </div>

        <div v-if="filteredArticles.length" class="flex flex-col gap-6">
          <div
            v-for="a in filteredArticles"
            :key="a.id"
            class="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.005]"
          >
            <NuxtLink :to="`/articles/${a.slug}`" class="flex flex-col gap-4">
              <div class="flex flex-col sm:flex-row gap-4">
                <NuxtImg
                  v-if="a.imageUrl"
                  :src="a.imageUrl"
                  :alt="`Titulní obrázek k článku: ${a.title}`"
                  format="webp"
                  quality="80"
                  width="160"
                  height="80"
                  class="rounded-xl shadow-md border border-gray-100 object-cover w-full sm:w-40 h-auto max-h-[80px]"
                />
                <div class="flex flex-col gap-2">
                  <h2
                    class="text-xl font-semibold text-gray-900 hover:text-blue-700 transition-all"
                  >
                    {{ a.title }}
                  </h2>
                  <div class="flex items-center gap-4 text-base text-gray-600">
                    <span>{{
                      a.status === 'draft' ? 'Návrh' : 'Publikováno'
                    }}</span>
                    <span>|</span>
                    <span>{{ formatDate(a.createdAt.toString()) }}</span>
                    <span>|</span>
                    <span>{{ a.user.username }}</span>
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>
        <p v-else class="text-gray-600 text-base">
          Žádné články s tímto tagem.
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ArticleStatus } from '@zenstackhq/runtime/models'
import { format } from 'date-fns'
import { useRoute } from 'vue-router'

type Article = {
  slug: string
  id: string
  title: string
  content: string
  imageUrl: string | null
  status: ArticleStatus
  createdAt: Date
  userId: string
  user: { username: string }
  tags: { tagId: string; tag: { name: string } }[]
}

type TagResponse = { name: string } | { success: boolean }

const route = useRoute()
const tagId = computed(() => route.params.tagId as string)
const search = ref('')
const sort = ref('createdAt:desc')

const { data: tag } = await useFetch<TagResponse>(`/api/tags/${tagId.value}`, {
  default: () => ({ name: 'Neznámý tag' }),
})
const tagName = computed(() =>
  'name' in tag.value ? tag.value.name : 'Neznámý tag',
)

const { data: articles } = await useFetch<Article[]>(
  `/api/articles/${tagId.value}/bytag`,
  {
    default: () => [],
  },
)

const filteredArticles = computed(() => {
  const result = articles.value.filter((a) =>
    a.title.toLowerCase().includes(search.value.toLowerCase()),
  )

  const [field, order] = sort.value.split(':')
  result.sort((a, b) => {
    if (field === 'createdAt') {
      return order === 'asc'
        ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    } else {
      return order === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title)
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
