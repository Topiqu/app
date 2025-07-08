<template>
  <div
    v-if="data"
    class="min-h-screen bg-gradient-to-br from-gray-50 to-white p-6 transition-all duration-300 ease-in-out"
  >
    <div class="max-w-4xl mx-auto">
      <NuxtLink
        to="/"
        class="inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold mb-6 transition-colors duration-200 ease-in-out hover:underline decoration-2 underline-offset-4"
      >
        <Icon name="mdi:arrow-left" class="w-5 h-5 mr-2" />
        Zpět na seznam
      </NuxtLink>
      <h1
        class="text-4xl font-extrabold text-gray-900 mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent animate-fade-in-slow"
      >
        {{ data.title }}
      </h1>
      <div class="flex items-center gap-4 text-sm text-gray-600 mb-6">
        <span class="font-medium">Stav:</span>
        <span v-if="user">
          <ArticleStatusCell :onUpdate="setStatus" :row="{ original: data }" />
        </span>
        <span v-else class="font-medium">{{
          data.status === 'draft' ? 'Návrh' : 'Publikováno'
        }}</span>
        <span class="text-gray-400">|</span>
        <span class="font-medium"
          >Datum: {{ formatDate(data.createdAt.toString()) }}</span
        >
      </div>
      <div
        class="prose max-w-none bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-all duration-300 ease-in-out hover:shadow-xl hover:border-gray-300"
        v-html="data.content"
      />
      <div v-if="hasTags" class="mt-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Tagy</h3>
        <div class="flex flex-wrap gap-3">
          <span
            v-for="tag in data.tags"
            :key="tag"
            class="bg-gradient-to-r from-indigo-50 to-purple-100 text-indigo-800 px-3 py-1 rounded-full text-sm shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
  <div
    v-else-if="error"
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white"
  >
    <div
      class="text-center p-6 bg-white rounded-2xl shadow-lg border border-gray-200"
    >
      <Icon
        name="mdi:alert-circle"
        class="w-16 h-16 text-red-500 mx-auto mb-4"
      />
      <p class="text-lg text-gray-700">{{ errorMessage }}</p>
      <NuxtLink
        to="/"
        class="mt-4 inline-flex items-center text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200 ease-in-out hover:underline decoration-2 underline-offset-4"
      >
        <Icon name="mdi:arrow-left" class="w-5 h-5 mr-2" />
        Zpět na seznam
      </NuxtLink>
    </div>
  </div>
  <div
    v-else
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white"
  >
    <Icon
      name="mdi:loading"
      class="w-12 h-12 text-blue-500 animate-spin-slow"
    />
  </div>
</template>

<script lang="ts" setup>
import type { Article, ArticleStatus } from '@zenstackhq/runtime/models'
import { format } from 'date-fns'
import { useRoute } from 'vue-router'

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
.animate-fade-in-slow {
  animation: fadeIn 1.5s ease-out;
}
.animate-spin-slow {
  animation: spin 1.5s linear infinite;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.shadow-md {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.shadow-lg {
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}
.shadow-xl {
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
}
</style>
