<template>
  <div v-if="data" class="min-h-screen p-8 md:p-12 transition-all duration-500 ease-out">
    <div
      class="fixed top-0 left-0 w-full bg-white dark:bg-neutral-900 shadow-md z-10 opacity-0 translate-y-[-100%] transition-all duration-300 ease-in-out"
      :class="{ 'opacity-100 translate-y-0': isSticky }"
    >
      <div class="max-w-4xl mx-auto flex items-center justify-between px-4 py-4">
        <NuxtLink
          to="/admin"
          class="group inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 no-underline"
          aria-label="Zpět na seznam článků"
        >
          <Icon
            name="mdi:arrow"
            class="w-6 h-6 mr-2 transition-transform duration-300 group-hover:-translate-x-1.5 text-blue-700"
          />
          Zpět na seznam
        </NuxtLink>
        <h1
          class="text-xl font-extrabold text-gray-900 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight leading-tight"
        >
          {{ data.title }}
        </h1>
      </div>
    </div>
    <div class="max-w-4xl mx-auto flex flex-col gap-8 px-4 sm:px-0">
      <NuxtLink
        to="/admin"
        class="group inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 no-underline"
        aria-label="Zpět na seznam článků"
      >
        <Icon
          name="mdi:arrow"
          class="w-6 h-6 mr-2 transition-transform duration-300 group-hover:-translate-x-1.5 text-blue-700"
        />
        Zpět na seznam
      </NuxtLink>
      <h1
        class="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight leading-tight"
      >
        {{ data.title }}
      </h1>
      <div class="flex items-center gap-3 text-sm text-gray-600 mt-[-8px]">
        <NuxtImg
          v-if="data.user.avatarUrl"
          :src="data.user.avatarUrl"
          :alt="`Avatar autora: ${data.user.username}`"
          format="webp"
          quality="80"
          width="24"
          height="24"
          class="w-8 h-8 rounded-full object-cover"
        />
        <Icon v-else name="mdi:account" class="w-6 h-6 text-blue-500" />
        <NuxtLink
          :to="`/autor/${data.user.username}`"
          class="font-medium text-[17px] text-blue-600 hover:text-blue-800 transition"
          >{{ data.user.username }}</NuxtLink
        >
        <span class="italic text-gray-400">• Autor článku</span>
        <button
          v-if="session?.user && session.user.id !== data.user.id"
          class="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all duration-200 hover:shadow-md transform hover:scale-105 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500"
          :aria-label="isFollowing ? 'Přestat sledovat autora' : 'Sledovat autora'"
          @click="toggleFollow"
        >
          <Icon
            :name="isFollowing ? 'mdi:account-check' : 'mdi:account-plus'"
            class="w-4 h-4"
            :class="isFollowing ? 'text-green-500' : 'text-gray-500'"
          />
          {{ isFollowing ? 'Sledování' : 'Sledovat' }}
        </button>
      </div>
      <NuxtImg
        v-if="data.imageUrl"
        :src="data.imageUrl"
        :alt="`Titulní obrázek k článku: ${data.title}`"
        format="webp"
        quality="80"
        width="800"
        height="400"
        class="rounded-xl shadow-md border border-gray-100 object-contain object-center w-full aspect-video max-h-[400px] transition-transform duration-500 hover:scale-[1.005]"
        aria-describedby="image-caption"
      />
      <span id="image-caption" class="sr-only">Titulní obrázek článku</span>
      <div v-if="hasTags" class="mt-4">
        <div class="flex flex-wrap gap-2.5">
          <NuxtLink
            v-for="t in data.tags"
            :key="t.tag.slug"
            :to="`/stitky/${t.tag.slug}`"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <Icon name="mdi:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
            {{ t.tag.name }}
          </NuxtLink>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-md text-gray-600 mt-4">
        <div class="flex flex-wrap items-center gap-4">
          <div
            v-if="session?.user.role === 'admin' && session.user.id === data.user.id"
            class="flex items-center gap-3 flex-wrap"
          >
            <span class="font-medium whitespace-nowrap">Stav:</span>
            <ArticleStatusCell :onUpdate="debouncedSetStatus" :row="{ original: data }" />
            <span
              v-if="session?.user.role === 'admin' && data.status === 'published'"
              class="w-2 h-2 bg-green-500 rounded-full ml-2 animate-pulse-slow"
              aria-label="Článek je publikován"
            ></span>
            <span class="text-gray-400 hidden sm:inline">|</span>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Komentáře</span>
              <button
                role="switch"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                  data.allowedComments ? 'bg-blue-600' : 'bg-gray-500 dark:bg-gray-600',
                ]"
                @click="((data.allowedComments = !data.allowedComments), toggleComments())"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    data.allowedComments ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2 text-gray-500">
            <Icon name="mdi:calendar" class="w-4 h-4" />
            <span>{{ formatDate(data.createdAt.toString()) }}</span>
          </div>
          <span class="text-gray-400 hidden sm:inline">|</span>
          <div class="flex items-center gap-2 text-gray-500">
            <Icon name="mdi:clock-outline" class="w-4 h-4" />
            <span>{{ data.readingTime }} min čtení</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 text-gray-500">
            <span>{{ data.views }}x zhlédnutí</span>
          </div>
          <div class="flex items-center gap-2 text-gray-500">
            <Icon name="mdi:heart" class="w-4 h-4" :class="{ 'text-red-500': data.likedByUser }" />
            <span>{{ data.likes }}x</span>
          </div>
          <button
            v-if="session?.user.role === 'admin' && session.user.id === data.user.id"
            class="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
            aria-label="Upravit článek"
            @click="editingArticle = data"
          >
            <Icon name="mdi:pencil" class="w-5 h-5 text-gray-800" />
          </button>
        </div>
      </div>
      <div class="flex justify-end gap-4 mt-10">
        <button
          aria-label="Lajknout článek"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 cursor-pointer hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400 dark:hover:border-red-400"
          title="Lajknout článek"
          @click="toggleLike"
        >
          <Icon name="mdi:heart" class="w-5 h-5" :class="{ 'text-red-500 dark:text-red-400': data.likedByUser }" />
        </button>
        <button
          aria-label="Zkopírovat odkaz"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 cursor-pointer hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400 dark:hover:border-blue-500"
          title="Zkopírovat odkaz"
          @click="copyLink"
        >
          <Icon name="mdi:link-variant" class="w-5 h-5" />
        </button>
        <NuxtLink
          :to="`https://twitter.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          title="Sdílet na Twitteru"
          aria-label="Sdílet na Twitteru"
        >
          <Icon name="mdi:twitter" class="w-5 h-5" />
        </NuxtLink>
        <NuxtLink
          :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          title="Sdílet na LinkedIn"
          aria-label="Sdílet na LinkedIn"
        >
          <Icon name="mdi:linkedin" class="w-5 h-5" />
        </NuxtLink>
      </div>
      <div
        class="max-w-4xl bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-500 text-[17px] md:text-lg leading-[1.8] text-gray-800 tracking-normal space-y-6 prose prose-gray prose-a:text-blue-600 prose-a:no-underline hover:prose-a:text-blue-800 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 dark:bg-neutral-900 dark:text-gray-200 dark:border-gray-700 dark:hover:border-gray-600 dark:prose-invert dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-blockquote:border-gray-600"
        v-html="data.content"
      />
      <ArticleRelated :articles="relatedArticles" />
      <CommentSection :articleId="data.id" :commCount="data.commentCount || 0" :allowComments="data.allowedComments" />
      <ArticleTOC :content="data.content" />
    </div>
    <TransitionRoot :show="!!editingArticle" as="template">
      <ArticleEdit :article="editingArticle!" @close="editingArticle = null" @saved="refresh" />
    </TransitionRoot>
  </div>
  <div v-else-if="error" class="min-h-screen flex items-center justify-center">
    <div class="text-center p-8 md:p-10 bg-white rounded-2xl shadow-lg border border-gray-100">
      <Icon name="mdi:alert-circle" class="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" aria-hidden="true" />
      <p class="text-lg md:text-xl text-gray-500 font-medium">{{ errorMsg }}</p>
      <NuxtLink
        to="/"
        class="mt-4 inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 no-underline hover:underline decoration-2 underline-offset-4"
        aria-label="Zpět na seznam článků"
      >
        <Icon name="mdi:arrow-left" class="w-6 h-6 mr-2 text-blue-700" />
        Zpět na seznam
      </NuxtLink>
    </div>
  </div>
  <div v-else class="min-h-screen flex items-center justify-center">
    <Icon name="mdi:loading" class="w-14 h-14 text-blue-600 animate-spin" />
  </div>
</template>

<script lang="ts" setup>
import type { ArticleStatus, Article as _Article, User } from '@zenstackhq/runtime/models'

import { TransitionRoot } from '@headlessui/vue'

type Article = _Article & {
  user: { username: string; id: string; avatarUrl: string }
  tags?: { tag: { name: string; slug: string; id: string } }[]
  commentCount?: number
  likes: number
  likedByUser: boolean
  allowedComments: boolean
}

type RelatedArticle = { article: _Article & { user: { username: string } } }

const route = useRoute()
const toast = useToast()
const { data: session } = useAuth()
const editingArticle = ref<Article | null>(null)
const slug = computed(() => route.params.slug)
const isFollowing = ref(false)
const relatedArticles = ref<RelatedArticle[]>([])
const isSticky = ref(false)

const {
  data,
  execute: refresh,
  error,
} = await useFetch<Article | null>(`/api/articles/${slug.value}`, { default: () => null })
const { data: follows, refresh: refreshFollows } = await useFetch<User[]>('/api/follows/followed')
isFollowing.value = follows.value?.some((f) => f.id === data.value?.userId) || false

const fullUrl = computed(() => (import.meta.client ? window.location.href : ''))

watch(
  () => data.value,
  async (article) => {
    if (article?.id && article.tags?.length) {
      const res = await $fetch<{ articles: RelatedArticle[] }>(`/api/tags/${article.tags[0]?.tag.id}?limit=4`)
      relatedArticles.value = res.articles.filter((a) => a.article.id !== article.id)
    } else {
      relatedArticles.value = []
    }
  },
  { immediate: true },
)

const toggleFollow = async () => {
  if (!session.value?.user || !data.value?.user.id) {
    toast.error({ message: 'Musíte být přihlášeni' })
    return
  }
  try {
    if (isFollowing.value) {
      await $fetch(`/api/follows/${data.value.user.id}`, { method: 'DELETE' })
      isFollowing.value = false
      toast.success({ message: `Přestali jste sledovat ${data.value.user.username}` })
    } else {
      await $fetch(`/api/follows/`, { method: 'POST', body: { followedId: data.value.user.id } })
      isFollowing.value = true
      toast.success({ message: `Nyní sledujete ${data.value.user.username}` })
    }
    await refreshFollows()
  } catch (e: any) {
    if (e.data?.statusCode === 409) {
      isFollowing.value = true
    } else {
      toast.error({
        message: e.data?.message || (isFollowing.value ? 'Přestání sledování selhalo' : 'Sledování selhalo'),
      })
    }
  }
}

const copyLink = () => {
  navigator.clipboard.writeText(fullUrl.value)
  toast.success({ message: 'Odkaz zkopírován do schránky!' })
}

const toggleLike = async () => {
  if (!data.value?.slug) return
  const key = `liked-${data.value.slug}`
  const hasLiked = sessionStorage.getItem(key)
  if (hasLiked && !session.value?.user.id) {
    data.value.likedByUser = false
    data.value.likes -= 1
    sessionStorage.removeItem(key)
    return
  }
  try {
    const res = await $fetch(`/api/articles/${data.value.id}/reaction`, { method: 'POST' })
    data.value.likedByUser = res.liked
    data.value.likes = res.likes
    if (res.liked && !session.value?.user.id) sessionStorage.setItem(key, 'true')
    await refresh()
  } catch {
    toast.error({ message: 'Lajkování selhalo' })
  }
}

const toggleComments = async () => {
  if (!data.value?.id) return
  try {
    await $fetch(`/api/articles/${data.value.id}`, {
      method: 'PATCH',
      body: { allowedComments: data.value.allowedComments },
    })
    toast.success({ message: `Komentáře ${data.value.allowedComments ? 'povoleny' : 'zakázány'}` })
    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Změna selhala' })
    data.value.allowedComments = !data.value.allowedComments
  }
}

useSeoMeta({
  title: () => data.value?.title || 'Článek',
  description: () => data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) || 'Přečtěte si článek...',
  ogTitle: () => data.value?.title || 'Článek',
  ogDescription: () => data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) || 'Přečtěte si článek...',
  ogImage: () => data.value?.imageUrl || '',
})

const errorMsg = computed(() => (error.value ? `Chyba: ${error.value.message || 'Zkuste znovu'}` : ''))

const hasTags = computed(() => !!data.value?.tags?.length)

const debouncedSetStatus = useDebounceFn(async (id: string, status: ArticleStatus) => {
  try {
    await $fetch(`/api/articles/${id}`, { method: 'PATCH', body: { status } })
    await refresh()
    toast.success({ message: `Stav na ${status === 'draft' ? 'návrh' : 'publikováno'}` })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Změna selhala' })
  }
}, 100)

onMounted(async () => {
  const onScroll = () => {
    isSticky.value = window.scrollY > 100
  }
  window.addEventListener('scroll', onScroll)
  onUnmounted(() => window.removeEventListener('scroll', onScroll))

  if (!data.value?.id) return
  const key = `viewed-${data.value.id}`
  const lastView = sessionStorage.getItem(key)
  const now = Date.now()
  if (lastView && now - Number(lastView) <= 1000) return
  try {
    await $fetch(`/api/articles/${data.value.id}`, { method: 'PATCH', body: { views: data.value.views + 1 } })
    sessionStorage.setItem(key, now.toString())
  } catch {
    //
  }
})
</script>
