<template>
  <div
    v-if="data"
    class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 transition-all duration-500 ease-out"
  >
    <div class="max-w-3xl mx-auto flex flex-col gap-6 px-2 sm:px-0">
      <NuxtLink
        to="/admin"
        class="group inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 ease-in-out no-underline"
        aria-label="Zpět na seznam článků"
      >
        <Icon
          name="mdi:arrow"
          class="w-6 h-6 mr-2 transition-transform duration-300 group-hover:-translate-x-1.5"
        />
        Zpět na seznam
      </NuxtLink>

      <h1
        class="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight leading-tight"
      >
        {{ data.title }}
      </h1>

      <div class="flex items-center gap-3 text-sm text-gray-600 mt-[-8px]">
        <Icon name="mdi:account" class="w-4 h-4 text-blue-500" />
        <span class="font-medium text-gray-800">{{ data.user.username }}</span>
        <span class="italic text-gray-400">• Autor článku</span>
      </div>

      <NuxtImg
        v-if="data.imageUrl"
        :src="data.imageUrl"
        :alt="`Titulní obrázek k článku: ${data.title}`"
        format="webp"
        quality="80"
        width="672"
        height="336"
        class="rounded-xl shadow-md border border-gray-100 object-cover object-center w-full h-auto max-h-[320px] transition-transform duration-500 hover:scale-[1.005]"
        aria-describedby="image-caption"
      />
      <span id="image-caption" class="sr-only">Titulní obrázek článku</span>

      <div v-if="hasTags" class="mt-4">
        <div class="flex flex-wrap gap-2.5">
          <NuxtLink
            v-for="t in data.tags"
            :key="t.tag.slug"
            :to="`/tags/${t.tag.slug}`"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all"
          >
            <Icon name="mdi:tag" class="w-4 h-4 text-gray-500" />
            {{ t.tag.name }}
          </NuxtLink>
        </div>
      </div>

      <div
        class="flex items-center justify-between text-md text-gray-600 flex-wrap gap-3 mt-4"
      >
        <div class="flex items-center gap-4">
          <div
            v-if="session?.user.role === 'admin'"
            class="flex items-center gap-3"
          >
            <span class="font-medium">Stav:</span>
            <ArticleStatusCell
              :onUpdate="setStatus"
              :row="{ original: data }"
            />
            <span
              v-if="
                session?.user.role === 'admin' && data.status === 'published'
              "
              class="w-2 h-2 bg-green-500 rounded-full ml-2 animate-pulse-slow"
              aria-label="Článek je publikován"
            ></span>
            <span class="text-gray-400">|</span>
          </div>

          <div class="flex items-center gap-2 text-gray-500">
            <Icon name="mdi:calendar" class="w-4 h-4" />
            <span>{{ formatDate(data.createdAt.toString()) }}</span>
          </div>

          <span class="text-gray-400">|</span>

          <div class="flex items-center gap-2 text-gray-500">
            <Icon name="mdi:clock-outline" class="w-4 h-4" />
            <span>{{ data.readingTime }} min čtení</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 text-gray-500">
            <span>{{ data.views }}x zhlédnutí</span>
          </div>
          <button
            v-if="session?.user.role === 'admin'"
            class="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
            aria-label="Upravit článek"
            @click="editingArticle = data"
          >
            <Icon name="mdi:pencil" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-4 mt-10">
        <button
          aria-label="Zkopírovat odkaz"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:cursor-pointer hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
          title="Zkopírovat odkaz"
          @click="copyLink"
        >
          <Icon name="mdi:link-variant" class="w-5 h-5" />
        </button>
        <NuxtLink
          :to="`https://twitter.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
          target="_blank"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
          title="Sdílet na Twitteru"
          aria-label="Sdílet na Twitteru"
        >
          <Icon name="mdi:twitter" class="w-5 h-5" />
        </NuxtLink>
        <NuxtLink
          :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
          target="_blank"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
          title="Sdílet na LinkedIn"
          aria-label="Sdílet na LinkedIn"
        >
          <Icon name="mdi:linkedin" class="w-5 h-5" />
        </NuxtLink>
      </div>

      <div
        class="max-w-none bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-500 text-base md:text-lg leading-7 text-gray-800 tracking-normal space-y-5 prose prose-gray prose-a:text-blue-600 prose-a:no-underline hover:prose-a:text-blue-800 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6"
        v-html="data.content"
      />
      <section v-if="relatedArticles.length" class="mt-20">
        <h2 class="text-2xl font-bold text-gray-900 mb-8 tracking-tight">
          Související články
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="article in relatedArticles"
            :key="article.articleId"
            :to="`/articles/${article.article.slug}`"
            class="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-transform duration-300 no-underline"
          >
            <NuxtImg
              v-if="article.article.imageUrl"
              :src="article.article.imageUrl"
              :alt="`Titulní obrázek k článku: ${article.article.title}`"
              format="webp"
              quality="80"
              width="320"
              height="160"
              class="w-full h-[120px] object-cover rounded-t-2xl border-b border-gray-100"
            />
            <div class="p-4 flex flex-col gap-2 flex-grow">
              <h3 class="text-base font-semibold text-gray-900 line-clamp-2">
                {{ article.article.title }}
              </h3>
              <div class="text-xs text-gray-500 flex items-center gap-2">
                <Icon name="mdi:calendar" class="w-4 h-4 text-gray-400" />
                {{ formatDate(article.article.createdAt.toString()) }}
                <span class="mx-1">•</span>
                <Icon name="mdi:account" class="w-4 h-4 text-gray-400" />
                <span class="truncate">{{
                  article.article.user.username
                }}</span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>
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
        class="mt-4 inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 no-underline hover:underline decoration-2 underline-offset-4"
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
import { useDebounceFn } from '@vueuse/core'
import type {
  ArticleStatus,
  Article as _Article,
} from '@zenstackhq/runtime/models'
import { format } from 'date-fns'

type Article = _Article & {
  user: { username: string }
  tags?: { tag: { name: string; slug: string } }[]
}

type RelatedArticle = {
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

const route = useRoute()
const { data: session } = useAuth()
const toast = useToast()
const editingArticle = ref<Article | null>(null)

const slug = computed(() => route.params.slug)

const { data, error } = await useFetch<Article | null>(
  `/api/articles/${slug.value}`,
  {
    default: () => null,
  },
)
const fullUrl = computed(() => (import.meta.client ? window.location.href : ''))
function copyLink() {
  navigator.clipboard.writeText(fullUrl.value)
  toast.success({ message: 'Odkaz zkopírován do schránky!' })
}

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

onMounted(async () => {
  if (!data.value) return
  try {
    await $fetch(`/api/articles/${data.value.id}`, {
      method: 'PATCH',
      body: {
        id: data.value.id,
        views: data.value.views + 1,
        content: data.value.content,
      },
    })
  } catch (err) {
    console.error('Error updating article:', err)
    // optionally log error
  }
})

const formatDate = (date: string) => format(new Date(date), 'dd.MM.yyyy, HH:mm')

const hasTags = computed(() => !!data.value?.tags?.length)

const debouncedSetStatus = useDebounceFn(
  async (id: string, status: ArticleStatus) => {
    try {
      await $fetch(`/api/articles/${id}/status`, {
        method: 'PATCH',
        body: { status },
      })
      await refresh()
      toast.success({
        message: `Stav změněn na ${status === 'draft' ? 'návrh' : 'publikováno'}`,
      })
    } catch (e: any) {
      toast.error({ message: e.data?.message || 'Změna stavu selhala' })
    }
  },
  100,
)
async function setStatus(id: string, status: ArticleStatus) {
  debouncedSetStatus(id, status)
}

const refresh = async () => {
  const { data: newData } = await useFetch<Article | null>(
    `/api/articles/${slug.value}`,
    { default: () => null },
  )
  data.value = newData.value
}

const relatedArticles = ref<RelatedArticle[]>([])

const fetchRelatedArticles = async () => {
  if (!data.value?.tags?.length) {
    relatedArticles.value = []
    return
  }
  const tagSlug = data.value.tags[0].tag.slug
  const res = await $fetch<{ articles: RelatedArticle[] }>(
    `/api/tags/slug/${tagSlug}?limit=4`,
  )
  relatedArticles.value = res.articles.filter(
    (a) => a.articleId !== data.value!.id,
  )
}
onMounted(async () => {
  if (!data.value?.id) return

  const viewedKey = `viewed-${data.value.id}`
  const lastViewed = sessionStorage.getItem(viewedKey)
  const now = Date.now()

  if (!lastViewed || now - Number(lastViewed) > 1000) {
    try {
      await $fetch(`/api/articles/${data.value.id}/view-update`, {
        method: 'PATCH',
        body: {
          views: data.value.views + 1,
        },
      })
      sessionStorage.setItem(viewedKey, now.toString())
    } catch (err) {
      console.error('Error updating article views:', err)
    }
  }

  await fetchRelatedArticles()
})
</script>
