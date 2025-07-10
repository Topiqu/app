<template>
  <div
    v-if="data"
    class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 transition-all duration-500 ease-out"
  >
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

      <h1
        class="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight leading-tight"
      >
        {{ data.title }}
      </h1>

      <NuxtImg
        v-if="data.imageUrl"
        :src="data.imageUrl"
        :alt="`Titulní obrázek k článku: ${data.title}`"
        format="webp"
        quality="80"
        width="672"
        height="336"
        class="rounded-xl shadow-md border border-gray-100 object-cover w-full h-auto max-h-[320px] transition-transform duration-500 hover:scale-[1.005]"
        aria-describedby="image-caption"
      />
      <span id="image-caption" class="sr-only">Titulní obrázek článku</span>

      <div v-if="hasTags" class="mt-4">
        <div class="flex flex-wrap gap-2.5">
          <span
            v-for="t in data.tags"
            :key="t.tagId"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all"
          >
            <Icon name="mdi:tag" class="w-4 h-4 text-gray-500" />
            {{ t.tag.name }}
          </span>
        </div>
      </div>

      <div
        class="flex items-center justify-between text-lg text-gray-600 flex-wrap gap-3"
      >
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-3">
            <span class="font-medium">Stav:</span>
            <ArticleStatusCell
              v-if="user"
              :onUpdate="setStatus"
              :row="{ original: data }"
            />
            <span v-else class="font-medium">
              {{ data.status === 'draft' ? 'Návrh' : 'Publikováno' }}
            </span>
          </div>
          <div class="flex items-center gap-2 text-gray-500">
            <Icon name="mdi:calendar" class="w-4 h-4" />
            <span>{{ formatDate(data.createdAt.toString()) }}</span>
          </div>
        </div>
        <div v-if="user" class="flex items-center gap-2">
          <button
            class="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
            aria-label="Upravit článek"
            @click="editingArticle = data"
          >
            <Icon name="mdi:pencil" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        class="max-w-none bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-500 text-base md:text-lg leading-7 text-gray-800 tracking-normal space-y-5 prose prose-gray prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6"
        v-html="data.content"
      />
    </div>

    <TransitionRoot :show="!!editingArticle" as="template">
      <ArticleEdit
        :article="editingArticle!"
        @close="editingArticle = null"
        @saved="refresh"
      />
    </TransitionRoot>
  </div>

  <div
    v-else-if="error"
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"
  >
    <div
      class="text-center p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-gray-100"
    >
      <Icon
        name="mdi:alert-circle"
        class="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse"
        aria-hidden="true"
      />
      <p class="text-lg md:text-xl text-gray-700 font-medium">
        {{ errorMessage }}
      </p>
      <NuxtLink
        to="/"
        class="mt-4 inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 hover:underline decoration-2 underline-offset-4"
        aria-label="Zpět na seznam článků"
      >
        <Icon name="mdi:arrow-left" class="w-6 h-6 mr-2" />
        Zpět na seznam
      </NuxtLink>
    </div>
  </div>

  <div
    v-else
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100"
  >
    <Icon name="mdi:loading" class="w-14 h-14 text-blue-600 animate-spin" />
  </div>
</template>

<script lang="ts" setup>
import { TransitionRoot } from '@headlessui/vue'
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
  tags?: { tagId: string; tag: { name: string } }[]
}

const route = useRoute()
const { data: user } = useAuth()
const toast = useToast()
const editingArticle = ref<Article | null>(null)

const slug = computed(() => route.params.slug)

const { data, error } = await useFetch<Article | null>(
  `/api/articles/${slug.value}`,
  {
    default: () => null,
  },
)

useSeoMeta({
  title: () => data.value?.title || 'Článek',
  description: () =>
    data.value?.content
      ? data.value.content.replace(/<[^>]+>/g, '').slice(0, 160)
      : 'Přečtěte si tento článek na našem webu.',
  ogTitle: () => data.value?.title || 'Článek',
  ogDescription: () =>
    data.value?.content
      ? data.value.content.replace(/<[^>]+>/g, '').slice(0, 160)
      : 'Přečtěte si tento článek na našem webu.',
  ogImage: () => data.value?.imageUrl || '',
})

const errorMessage = computed(() =>
  error.value
    ? `Nepodařilo se načíst článek. ${error.value.message || 'Zkuste to znovu.'}`
    : '',
)

const formatDate = (date: string) => format(new Date(date), 'dd.MM.yyyy, HH:mm')

const hasTags = computed(() => {
  if (!data.value?.tags) return false
  if (Array.isArray(data.value.tags)) return data.value.tags.length > 0
  return Object.keys(data.value.tags).length > 0
})

async function setStatus(id: string, status: ArticleStatus) {
  try {
    await $fetch(`/api/articles/${id}/status`, {
      method: 'PATCH',
      body: { status },
    })
    await refresh()
    toast.success({
      message: `Stav změněn na ${status === 'draft' ? 'Návrh' : 'Publikováno'}`,
    })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Změna stavu selhala' })
  }
}

const refresh = async () => {
  const { data: newData } = await useFetch<Article | null>(
    `/api/articles/${slug.value}`,
    { default: () => null, key: `article-${slug.value}` },
  )
  data.value = newData.value
}
</script>
