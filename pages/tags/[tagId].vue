<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-100 to-white p-6">
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4">
      <NuxtLink
        to="/"
        class="group inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-lg transition duration-300 no-underline"
        aria-label="Zpět na seznam článků"
      >
        <Icon
          name="mdi:arrow-left"
          class="w-5 h-5 mr-2 transition-transform duration-300 group-hover:-translate-x-1"
        />
        Zpět na seznam
      </NuxtLink>

      <h1
        class="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900"
      >
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
            :key="a.id"
            class="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300"
          >
            <NuxtLink
              :to="`/articles/${a.slug}`"
              class="flex flex-col gap-4 sm:flex-row sm:items-start no-underline"
            >
              <NuxtImg
                v-if="a.imageUrl"
                :src="a.imageUrl"
                :alt="`Titulní obrázek k článku: ${a.title}`"
                format="webp"
                quality="80"
                width="160"
                height="90"
                class="rounded-xl border border-gray-100 shadow-sm object-cover w-full sm:w-40 h-auto max-h-[90px]"
              />
              <div class="flex flex-col gap-2">
                <h2
                  class="text-xl font-semibold text-gray-900 hover:text-blue-600 transition"
                >
                  {{ a.title }}
                </h2>
                <div
                  class="flex flex-wrap items-center gap-3 text-sm text-gray-600"
                >
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium"
                  >
                    <Icon
                      :name="
                        a.status === 'draft'
                          ? 'mdi:pencil-outline'
                          : 'mdi:check-circle-outline'
                      "
                      class="w-4 h-4"
                    />
                    {{ a.status === 'draft' ? 'Návrh' : 'Publikováno' }}
                  </span>
                  <span>•</span>
                  <span>
                    <Icon
                      name="mdi:calendar"
                      class="w-4 h-4 inline mr-1 text-gray-500"
                    />
                    {{ formatDate(a.createdAt.toString()) }}
                  </span>
                  <span>•</span>
                  <span
                    class="inline-flex items-center gap-1 text-blue-500 font-medium"
                  >
                    <Icon name="mdi:account-outline" class="w-4 h-4" />
                    {{ a.user.username }}
                  </span>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>

        <p v-else class="text-gray-500 italic text-center py-8">
          Žádné články s tímto tagem nebyly nalezeny.
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
