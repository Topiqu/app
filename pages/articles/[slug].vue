<template>
  <div
    v-if="data"
    class="min-h-screen bg-gradient-to-br from-gray-100 to-gray-50 p-8 transition-all duration-500 ease-out"
  >
    <div class="max-w-5xl mx-auto flex flex-col gap-8">
      <NuxtLink
        to="/"
        class="group inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-all duration-300 ease-in-out"
      >
        <Icon
          name="mdi:arrow-left"
          class="w-5 h-5 mr-2 transition-transform duration-300 group-hover:-translate-x-1"
        />
        Zpět na seznam
      </NuxtLink>

      <h1
        class="text-5xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent tracking-tight"
      >
        {{ data.title }}
      </h1>

      <NuxtImg
        v-if="data.imageUrl"
        :src="data.imageUrl"
        :alt="`Titulní obrázek k článku: ${data.title}`"
        format="webp"
        quality="85"
        width="900"
        height="450"
        class="rounded-3xl shadow-2xl border border-gray-100 object-cover w-full h-auto max-h-[450px] transition-transform duration-500 hover:scale-[1.02]"
      />
      <div v-if="hasTags" class="mt-8">
        <h3 class="text-xl font-semibold text-gray-800 mb-4">Tagy</h3>
        <div class="flex flex-wrap gap-3">
          <span
            v-for="t in data.tags"
            :key="t.tagId"
            class="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-sm font-medium text-blue-900 border border-blue-200 shadow-sm hover:shadow-lg hover:bg-gradient-to-r hover:from-blue-100 hover:to-blue-200 transition-all duration-300 ease-in-out transform hover:-translate-y-0.5"
          >
            <Icon name="mdi:tag" class="w-4 h-4 mr-1.5 text-blue-600" />
            {{ t.tag.name }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-6 text-sm text-gray-600">
        <span class="font-medium">Stav:</span>
        <span v-if="user">
          <ArticleStatusCell :onUpdate="setStatus" :row="{ original: data }" />
        </span>
        <span v-else class="font-medium">
          {{ data.status === 'draft' ? 'Návrh' : 'Publikováno' }}
        </span>
        <span class="text-gray-300">|</span>
        <span class="font-medium">
          Datum: {{ formatDate(data.createdAt.toString()) }}
        </span>
      </div>

      <div
        class="prose max-w-none bg-white p-8 rounded-3xl shadow-xl border border-gray-100 transition-all duration-500 hover:shadow-2xl hover:border-gray-200"
        v-html="data.content"
      />
    </div>
  </div>

  <div
    v-else-if="error"
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50"
  >
    <div
      class="text-center p-8 bg-white rounded-3xl shadow-xl border border-gray-100"
    >
      <Icon
        name="mdi:alert-circle"
        class="w-20 h-20 text-red-500 mx-auto mb-6 animate-pulse"
      />
      <p class="text-xl text-gray-700 font-medium">{{ errorMessage }}</p>
      <NuxtLink
        to="/"
        class="mt-6 inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-all duration-300 hover:underline decoration-2 underline-offset-4"
      >
        <Icon name="mdi:arrow-left" class="w-5 h-5 mr-2" />
        Zpět na seznam
      </NuxtLink>
    </div>
  </div>

  <div
    v-else
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50"
  >
    <Icon name="mdi:loading" class="w-16 h-16 text-blue-600 animate-spin" />
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
  tags?: { tagId: string; tag: { name: string } }[]
}

const route = useRoute()
const { data: user } = useAuth()
const toast = useToast()

const slug = computed(() => route.params.slug)

const { data, error } = await useFetch<Article | null>(
  `/api/articles/${slug.value}`,
  {
    default: () => null,
  },
)

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

<style scoped>
.prose :deep(p) {
  margin: 0.75rem 0;
  line-height: 1.75;
  color: #4a5568;
}

.prose :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1rem 0;
  color: #2d3748;
}

.animate-spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
