<template>
  <div v-if="data" class="min-h-screen p-8 md:p-12 transition-all duration-500 ease-out relative">
    <div
      class="fixed top-0 hidden sm:block left-0 w-full bg-white dark:bg-neutral-900 shadow-md z-25 opacity-0 translate-y-[-100%] transition-all duration-300 ease-in-out"
      :class="{ 'opacity-100 translate-y-0': isSticky }"
    >
      <div class="max-w-[1000px] mx-auto flex items-center justify-between px-4 py-4">
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
      <div
        v-if="isSticky"
        class="h-1 transition-all duration-300 ease-in-out"
        :style="{ width: `${progress}%` }"
        style="background-color: #3b82f6"
      ></div>
    </div>
    <div ref="container" class="max-w-[1000px] mx-auto flex flex-col gap-8 px-4 sm:px-0">
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
      <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
        <NuxtImg
          v-if="data.user.avatarUrl"
          :src="data.user.avatarUrl"
          :alt="`Avatar autora: ${data.user.username}`"
          class="w-12 h-12 rounded-full object-cover"
        />
        <Icon v-else name="mdi:account" class="w-12 h-12 text-blue-500 rounded-full bg-gray-100 p-2 dark:bg-gray-800" />
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="`/autor/${data.user.username}`"
              class="font-medium text-[17px] text-blue-600 hover:text-blue-800 transition"
            >
              {{ data.user.username }}
            </NuxtLink>
            <span class="italic text-gray-400 text-sm">• Autor článku</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
            >
              <Icon name="mdi:account-group" class="w-3.5 h-3.5" />
              {{ data.followerCount ?? 0 }} sledujících
            </span>
            <button
              v-if="session?.user && session.user.id !== data.user.id"
              class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-xs cursor-pointer font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all duration-200 hover:shadow-md transform hover:scale-105 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500"
              :aria-label="isFollowing ? 'Přestat sledovat autora' : 'Sledovat autora'"
              @click="toggleFollow"
            >
              <Icon
                :name="isFollowing ? 'mdi:account-check' : 'mdi:account-plus'"
                class="w-3.5 h-3.5"
                :class="isFollowing ? 'text-green-500' : 'text-gray-500'"
              />
              {{ isFollowing ? 'Sledování' : 'Sledovat' }}
            </button>
          </div>
        </div>
      </div>
      <p
        v-if="data.excerpt"
        class="text-lg md:text-xl italic text-gray-700 dark:text-gray-200 leading-relaxed border border-gray-200 dark:border-gray-700 rounded-xl px-6 py-4 mb-3 shadow-sm"
      >
        {{ data.excerpt }}
      </p>
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
        loading="lazy"
        placeholder
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
      <div class="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600 mt-4">
        <div class="flex flex-wrap items-center gap-4">
          <template v-if="session?.user.role === 'admin' && session.user.id === data.user.id">
            <div class="flex items-center gap-2">
              <span class="font-medium">Stav:</span>
              <ArticleStatusCell :onUpdate="debouncedSetStatus" :row="{ original: data }" />
              <span
                v-if="data.status === 'published'"
                class="w-2 h-2 bg-green-500 rounded-full animate-pulse-slow"
                aria-label="Článek je publikován"
              />
            </div>
            <span class="text-gray-300">|</span>
            <div class="flex items-center gap-2">
              <span>Komentáře</span>
              <button
                role="switch"
                :class="[
                  'relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
                  data.allowedComments ? 'bg-blue-600' : 'bg-gray-500 dark:bg-gray-600',
                ]"
                @click="((data.allowedComments = !data.allowedComments), toggleComments())"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    data.allowedComments ? 'translate-x-5' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>
            <span class="text-gray-300">|</span>
          </template>
          <div class="flex items-center gap-2">
            <Icon name="mdi:calendar" class="w-4 h-4" />
            <span>{{ formatDate(data.createdAt) }}</span>
          </div>
          <span class="text-gray-300">|</span>
          <div class="flex items-center gap-2">
            <Icon name="mdi:clock-outline" class="w-4 h-4" />
            <span>{{ data.readingTime }} min čtení</span>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1">
            <span>{{ formatNumber(data.views) }}x zhlédnutí</span>
          </div>
          <div class="flex items-center gap-1">
            <Icon
              name="mdi:heart"
              class="w-4 h-4"
              :class="{ 'text-red-500': data.likedByUser, 'text-gray-500': !data.likedByUser }"
            />
            <span>{{ formatNumber(data.likes) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Icon name="mdi:share-variant" class="w-4 h-4 text-gray-500" />
            <span>{{ formatNumber(data.shared) }}</span>
          </div>
          <LazyArticleEdit
            v-if="session?.user.role === 'admin' && session.user.id === data.user.id"
            v-slot="{ open }"
            :article="data"
            hydrateOnInteraction
            @saved="refresh"
          >
            <button
              class="flex items-center justify-center w-9 h-9 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
              aria-label="Upravit článek"
              @click="open.value = true"
            >
              <Icon name="mdi:pencil" class="w-5 h-5" />
            </button>
          </LazyArticleEdit>
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
          :to="`https://x.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          title="Sdílet na X"
          aria-label="Sdílet na X"
          @click="share('TWITTER')"
        >
          <Icon name="mdi:twitter" class="w-5 h-5" />
        </NuxtLink>
        <NuxtLink
          :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          title="Sdílet na LinkedIn"
          aria-label="Sdílet na LinkedIn"
          @click="share('LINKEDIN')"
        >
          <Icon name="mdi:linkedin" class="w-5 h-5" />
        </NuxtLink>
      </div>
      <div
        ref="content"
        class="max-w-[1000px] bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-500 text-[17px] md:text-lg leading-[1.8] text-gray-800 tracking-normal space-y-6 prose prose-gray prose-a:text-blue-600 prose-a:no-underline hover:prose-a:text-blue-800 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 dark:bg-neutral-900 dark:text-gray-200 dark:border-gray-700 dark:hover:border-gray-600 dark:prose-invert dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-blockquote:border-gray-600"
        v-html="data.content"
      />
      <div class="w-full">
        <ClientSocials :clientSiteId="data.clientSiteId" class="flex gap-3 p-4" />
      </div>
      <VueEasyLightbox
        :visible="lightboxVisible"
        :imgs="images"
        :index="currentImageIndex"
        @hide="lightboxVisible = false"
      />
      <ArticleRelated :articles="relatedArticles" />
      <CommentSection :articleId="data.id" :commCount="data.commentCount || 0" :allowComments="data.allowedComments" />
      <ArticleTOC :content="data.content" />
    </div>
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
import type { ArticleStatus, User } from '@zenstackhq/runtime/models'

import VueEasyLightbox from 'vue-easy-lightbox'

import type { ArticleWithDetails, ArticleBase } from '../../../types/article'

type Image = { src: string; alt?: string }

const route = useRoute()
const toast = useToast()
const { data: session } = useAuth()
const slug = computed(() => route.params.slug)
const isFollowing = shallowRef(false)
const relatedArticles = ref<ArticleWithDetails[]>([])
const isSticky = shallowRef(false)
const content = ref<HTMLElement | null>(null)
const container = useTemplateRef('container')
const images = ref<Image[]>([])
const lightboxVisible = shallowRef(false)
const currentImageIndex = shallowRef(0)
const progress = shallowRef(0)

const { data, refresh, error } = await useFetch<ArticleBase | null>(`/api/articles/${slug.value}`, {
  default: () => null,
})
const { data: follows, refresh: refreshFollows } = await useFetch<User[]>('/api/follows/followed')

isFollowing.value = follows.value?.some((f) => f.id === data.value?.userId) || false

const fullUrl = computed(() => (import.meta.client ? window.location.href : ''))

const share = async (platform: 'TWITTER' | 'LINKEDIN' | 'OTHER') => {
  if (!data.value?.id) return
  try {
    await $fetch(`/api/articles/${data.value.id}/share`, {
      method: 'POST',
      body: { platform },
    })
    data.value.shared = (data.value.shared || 0) + 1
  } catch (err: any) {
    toast.error({ message: `Sdílení selhalo ${err.message}` })
  }
}

const toggleFollow = async () => {
  if (!session.value?.user || !data.value?.user.id) {
    toast.error({ message: 'Musíte být přihlášeni' })
    return
  }
  try {
    if (isFollowing.value) {
      const response = await $fetch(`/api/follows/${data.value.user.id}`, { method: 'DELETE' })
      isFollowing.value = false
      data.value.followerCount = response.followerCount ?? 0
      toast.success({ message: `Přestali jste sledovat ${data.value.user.username}` })
    } else {
      const response = await $fetch(`/api/follows/`, { method: 'POST', body: { followedId: data.value.user.id } })
      isFollowing.value = true
      data.value.followerCount = response.followerCount ?? 0
      toast.success({ message: `Nyní sledujete ${data.value.user.username}` })
    }
    await refreshFollows()
  } catch (e: any) {
    if (e.data?.statusCode === 409) {
      isFollowing.value = true
      const response = await $fetch(`/api/follows/`, { method: 'POST', body: { followedId: data.value.user.id } })
      data.value.followerCount = response.followerCount ?? 0
    } else {
      toast.error({
        message: e.data?.message || (isFollowing.value ? 'Přestání sledování selhalo' : 'Sledování selhalo'),
      })
    }
  }
}

const copyLink = async () => {
  navigator.clipboard.writeText(fullUrl.value)
  toast.success({ message: 'Odkaz zkopírován do schránky!' })
  await share('OTHER')
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

const handleContentScroll = () => {
  if (!content.value) return
  const contentRect = content.value.getBoundingClientRect()
  const contentTop = contentRect.top + window.scrollY
  const contentHeight = contentRect.height
  const windowScrollY = window.scrollY
  const windowHeight = window.innerHeight
  const scrollableDistance = contentHeight - windowHeight
  if (scrollableDistance > 0) {
    const scrollProgress = Math.max(0, windowScrollY - contentTop + windowHeight / 2)
    progress.value = Math.min(100, (scrollProgress / scrollableDistance) * 100)
  } else {
    progress.value = 0
  }
}

useSeoMeta({
  title: () => data.value?.title || 'Článek',
  description: () =>
    data.value?.excerpt?.slice(0, 160) ||
    data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) ||
    'Přečtěte si článek...',
  ogTitle: () => data.value?.title || 'Článek',
  ogDescription: () =>
    data.value?.excerpt?.slice(0, 160) ||
    data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) ||
    'Přečtěte si článek...',
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

onMounted(() => {
  const onScroll = () => {
    if (!container.value || !content.value) return
    isSticky.value = window.scrollY > 100
    handleContentScroll()
  }
  const extractImages = () => {
    if (!content.value) return
    const imgElements = content.value.querySelectorAll('img')
    images.value = Array.from(imgElements).map((img) => ({
      src: img.src,
      alt: img.alt || '',
    }))
  }
  const handleImageClick = (e: Event) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement
      const src = img.src
      const index = images.value.findIndex((i) => i.src === src)
      if (index !== -1) {
        currentImageIndex.value = index
        lightboxVisible.value = true
      }
    }
  }
  window.addEventListener('scroll', onScroll)
  content.value?.addEventListener('click', handleImageClick)
  setTimeout(() => {
    extractImages()
  }, 100)
  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    content.value?.removeEventListener('click', handleImageClick)
  })
  if (!data.value?.id) return
  const key = `viewed-${data.value.id}`
  const lastView = sessionStorage.getItem(key)
  const now = Date.now()
  if (lastView && now - Number(lastView) <= 1000) return
  try {
    $fetch(`/api/articles/${data.value.id}`, { method: 'PATCH', body: { views: data.value.views + 1 } })
    sessionStorage.setItem(key, now.toString())
  } catch {
    console.log('Failed to update article views')
  }
})

watch(
  () => data.value,
  async (article) => {
    if (article?.id && article.tags?.length) {
      const res = await $fetch<{ articles: ArticleWithDetails[] }>(`/api/tags/${article.tags[0]?.tag.id}?limit=4`)
      relatedArticles.value = res.articles.filter((a) => a.id !== article.id)
    } else {
      relatedArticles.value = []
    }
  },
  { immediate: true },
)
</script>

<style>
.prose p img {
  cursor: pointer !important;
}
.vue-easy-lightbox {
  z-index: 1000;
}
.vue-easy-lightbox img {
  max-height: 90vh;
  max-width: 90vw;
  object-fit: contain;
}
.prose p img {
  animation: fade-in 0.5s ease-out forwards;
}
</style>
