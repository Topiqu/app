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
          :aria-label="$t('common.actions.backToList')"
        >
          <Icon
            name="mdi:arrow"
            class="w-6 h-6 mr-2 transition-transform duration-300 group-hover:-translate-x-1.5 text-blue-700"
          />
          {{ $t('common.actions.backToList') }}
        </NuxtLink>
        <h1
          class="text-xl font-extrabold text-gray-900 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight leading-tight"
        >
          {{ data.title }}
        </h1>
      </div>
      <div
        v-if="isSticky"
        class="h-1 bg-gradient-to-r transition-all duration-300 ease-in-out"
        :class="progressBarColor"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>
    <div ref="container" class="max-w-[1000px] mx-auto flex flex-col gap-8 px-4 sm:px-0">
      <NuxtLink
        to="/admin"
        class="group inline-flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg transition-all duration-300 no-underline"
        :aria-label="$t('common.actions.backToList')"
      >
        <Icon
          name="mdi:arrow"
          class="w-6 h-6 mr-2 transition-transform duration-300 group-hover:-translate-x-1.5 text-blue-700"
        />
        {{ $t('common.actions.backToList') }}
      </NuxtLink>
      <h1
        class="text-4xl md:text-5xl font-extrabold text-gray-900 mb-3 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight leading-tight"
      >
        {{ data.title }}
      </h1>
      <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
        <UserPicture :url="data.user?.avatarUrl" :size="'md'" :name="data.user.username" />
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="localePath({ name: 'autor-name', params: { name: data.user.username } })"
              class="font-medium text-[17px] text-blue-600 hover:text-blue-800 transition"
            >
              {{ data.user.username }}
            </NuxtLink>
            <span class="italic text-gray-400 text-sm">• {{ $t('articles.articleCard.author') }}</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
            >
              <Icon name="mdi:account-group" class="w-3.5 h-3.5" />
              {{ data.followerCount ?? 0 }} {{ $t('profile.followers') }}
            </span>
            <button
              v-if="session?.user && session.user.id !== data.user.id"
              class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-xs cursor-pointer font-medium text-gray-700 bg-white border-gray-200 shadow-sm hover:bg-gray-100 transition-all duration-200 hover:shadow-md transform hover:scale-105 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500"
              @click="toggleFollow"
            >
              <Icon
                :name="isFollowing ? 'mdi:account-check' : 'mdi:account-plus'"
                class="w-3.5 h-3.5"
                :class="isFollowing ? 'text-green-500' : 'text-gray-500'"
              />
              {{ isFollowing ? $t('profile.unfollow') : $t('profile.follow') }}
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
        :alt="$t('articles.articleCard.imageAlt')"
        format="webp"
        quality="85"
        class="w-full max-h-[70vh] rounded-2xl object-contain bg-neutral-100 dark:bg-neutral-900 border border-gray-100/20 shadow-sm transition-transform duration-700 ease-in-out hover:scale-[1.008]"
        loading="lazy"
        placeholder
      />
      <span id="image-caption" class="sr-only">{{ $t('articles.articleCard.imageAlt') }}</span>
      <div v-if="hasTags" class="mt-4">
        <div class="flex flex-wrap gap-2.5">
          <NuxtLink
            v-for="t in data.tags"
            :key="t.tag.slug"
            :to="localePath({ name: 'stitky-slug', params: { slug: t.tag.name } })"
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
              <span class="font-medium">{{ $t('articles.columns.status') }}</span>
              <ArticleStatusCell :onUpdate="debouncedSetStatus" :row="{ original: data }" />
              <span v-if="data.status === 'published'" class="w-2 h-2 bg-green-500 rounded-full animate-pulse-slow" />
            </div>
            <span class="text-gray-300">|</span>
            <div class="flex items-center gap-2">
              <span>{{ $t('articles.comments.title') }}</span>
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
            <span>{{ $t('articles.readingTime', [data.readingTime]) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1">
            <span>{{ formatNumber(data.views) }}x {{ $t('stats.totalViews.title') }}</span>
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
              :aria-label="$t('common.actions.edit')"
              @click="open.value = true"
            >
              <Icon name="mdi:pencil" class="w-5 h-5" />
            </button>
          </LazyArticleEdit>
        </div>
      </div>
      <div class="flex justify-end gap-4 mt-10">
        <button
          :aria-label="$t('common.actions.like')"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 cursor-pointer hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400 dark:hover:border-red-400"
          :title="$t('common.actions.like')"
          @click="toggleLike"
        >
          <Icon name="mdi:heart" class="w-5 h-5" :class="{ 'text-red-500 dark:text-red-400': data.likedByUser }" />
        </button>
        <button
          :aria-label="$t('common.actions.copyLink')"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 cursor-pointer hover:text-blue-700 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400 dark:hover:border-blue-500"
          :title="$t('common.actions.copyLink')"
          @click="copyLink"
        >
          <Icon name="mdi:link-variant" class="w-5 h-5" />
        </button>
        <NuxtLink
          :to="`https://x.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          :title="$t('common.actions.shareX')"
          :aria-label="$t('common.actions.shareX')"
          @click="share('TWITTER')"
        >
          <Icon name="mdi:twitter" class="w-5 h-5" />
        </NuxtLink>
        <NuxtLink
          :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          :title="$t('common.actions.shareLinkedIn')"
          :aria-label="$t('common.actions.shareLinkedIn')"
          @click="share('LINKEDIN')"
        >
          <Icon name="mdi:linkedin" class="w-5 h-5" />
        </NuxtLink>
      </div>
      <div
        ref="content"
        class="max-w-[1000px] bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-500 text-[17px] md:text-lg leading-[1.8] text-gray-800 tracking-normal space-y-6 prose prose-gray prose-a:text-blue-600 prose-a:no-underline hover:prose-a:text-blue-800 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 dark:bg-neutral-900 dark:text-gray-200 dark:border-gray-700 dark:hover:border-gray-600 dark:prose-invert dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-blockquote:border-gray-600"
      >
        <ArticleParsed :content="data.content" :articleId="data.id" />
      </div>
      <div class="w-full">
        <ClientSocials :clientSiteId="data.clientSiteId" class="flex gap-3 p-4" />
      </div>
      <VueEasyLightbox
        :visible="lightboxVisible"
        :imgs="images"
        :index="currentImageIndex"
        @hide="lightboxVisible = false"
      />
      <ArticleRelated :articles="relatedArticles!" :pending />
      <div v-if="data.sources?.length" class="group w-full mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div
          class="flex items-center justify-between cursor-pointer select-none text-gray-700 dark:text-gray-300 font-medium text-lg hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-300"
          @click="isOpen = !isOpen"
        >
          <div class="flex items-center gap-2">
            <Icon name="mdi:book-open-page-variant" class="w-5 h-5 text-blue-500 dark:text-blue-400" />
            {{ $t('articles.columns.sources') }} ({{ data.sources.length }})
          </div>
          <Icon
            name="mdi:chevron-down"
            class="w-5 h-5 text-gray-400 transition-transform duration-300"
            :class="{ 'rotate-180': isOpen }"
          />
        </div>
        <transition name="fade-slide">
          <ul v-if="isOpen" class="mt-4 space-y-3 pl-1">
            <li v-for="source in data.sources" :key="source" class="flex items-center gap-3 group/item">
              <LazyNuxtImg
                :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${source}&size=32`"
                class="w-5 h-5 rounded-sm flex-shrink-0 opacity-80 group-hover/item:opacity-100 transition-opacity duration-200"
                alt="favicon"
              />
              <NuxtLink
                :to="source"
                target="_blank"
                rel="noreferrer"
                class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-4 transition-colors duration-200 truncate max-w-[calc(100%-2.5rem)]"
              >
                {{ source }}
              </NuxtLink>
            </li>
          </ul>
        </transition>
      </div>
      <CommentSection :articleId="data.id" :commCount="data.commentCount || 0" :allowComments="data.allowedComments" />
      <ArticleTOC :content="data.content" />
    </div>
  </div>
  <Status v-else-if="status" :status="status" :message="status === 'error' ? `${error?.message}` : ''" />
</template>

<script lang="ts" setup>
import type { ArticleStatus, User } from '@zenstackhq/runtime/models'

import { formatDate } from '~~/shared/utils'
import VueEasyLightbox from 'vue-easy-lightbox'
import { formatNumber } from '~~/shared/utils/number'

import { themes } from '~/composables/theme'

type Image = { src: string; alt?: string }

const route = useRoute()

const toast = useToast()

const clipboard = useClipboard()

const localePath = useLocalePath()

const { data: session } = useAuth()

const clientSite = await useClientSite()

const slug = computed(() => route.params.slug)

const { data, refresh, error, status } = await useFetch(`/api/articles/${slug.value}` as `/api/articles/:id`)

const { data: follows, refresh: refreshFollows } = await useFetch<User[]>('/api/follows/followed')

const { data: relatedArticles, pending } = await useFetch(
  `/api/articles/${slug.value}/related?limit=3` as `/api/articles/:id/related`,
  { lazy: true },
)

useSeoMeta({
  title: () => data.value?.title || $t('common.labels.article'),
  description: () =>
    data.value?.excerpt?.slice(0, 160) ||
    data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) ||
    $t('articles.noResults.message'),
  ogTitle: () => data.value?.title || $t('common.labels.article'),
  ogDescription: () =>
    data.value?.excerpt?.slice(0, 160) ||
    data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) ||
    $t('articles.noResults.message'),
  ogImage: () => data.value?.imageUrl || false,
})

const isOpen = shallowRef(data.value?.sources && data.value.sources.length <= 5)

const isFollowing = shallowRef<boolean>(follows.value?.some((f) => f.id === data.value?.userId) || false)

const toggleFollow = async () => {
  if (!session.value?.user || !data.value?.user.id) return toast.error({ message: $t('common.auth.loginPrompt') })

  try {
    if (isFollowing.value) {
      const response = await $fetch<{ success: true; followerCount: number }>(`/api/follows/${data.value.user.id}`, {
        method: 'DELETE',
      })

      isFollowing.value = false
      data.value.followerCount = response.followerCount ?? 0

      toast.success({ message: $t('common.messages.successGeneral') })
    } else {
      const response = await $fetch(`/api/follows/`, { method: 'POST', body: { followedId: data.value.user.id } })

      isFollowing.value = true
      data.value.followerCount = response.followerCount ?? 0

      toast.success({ message: $t('profile.messages.followSuccess', [data.value.user.username]) })
    }

    await refreshFollows()
  } catch (e: any) {
    if (e.data?.statusCode === 409) {
      isFollowing.value = true

      const response = await $fetch(`/api/follows/`, { method: 'POST', body: { followedId: data.value.user.id } })

      data.value.followerCount = response.followerCount ?? 0
    } else {
      toast.error({
        message:
          e.data?.message ||
          (isFollowing.value ? $t('profile.messages.profileUpdateError') : $t('profile.messages.followFailed')),
      })
    }
  }
}

const share = async (platform: 'TWITTER' | 'LINKEDIN' | 'OTHER') => {
  await $fetch(`/api/articles/${data.value?.id}/share`, {
    method: 'POST',
    body: { platform },
  })

  data.value!.shared = (data.value!.shared || 0) + 1
}

const fullUrl = computed(() => (import.meta.client ? window.location.href : ''))

const copyLink = async () => {
  clipboard.copy(fullUrl.value)
  toast.success({ message: $t('common.actions.copySuccess') })
  await share('OTHER')
}

const toggleLike = async () => {
  if (!data.value?.slug) return

  const key = `liked-${data.value.slug}`
  const hasLiked = sessionStorage.getItem(key)
  if (hasLiked && !session.value?.user.id) {
    data.value.likedByUser = false
    data.value.likes -= 1
    return sessionStorage.removeItem(key)
  }

  try {
    const res = await $fetch(`/api/articles/${data.value.id}/reaction`, { method: 'POST' })
    data.value.likedByUser = res.liked
    data.value.likes = res.likes
    if (res.liked && !session.value?.user.id) sessionStorage.setItem(key, 'true')

    await refresh()
  } catch {
    toast.error({ message: $t('articles.comments.reactionFailed') })
  }
}

const toggleComments = async () => {
  if (!data.value?.id) return
  try {
    await $fetch(`/api/articles/${data.value.id}`, {
      method: 'PATCH',
      body: { allowedComments: data.value.allowedComments },
    })

    toast.success({
      message: $t('articles.comments.toggleSuccess', [
        data.value.allowedComments
          ? $t('articles.comments.commentsEnabled')
          : $t('articles.comments.commentsDisabledSuccess'),
      ]),
    })

    await refresh()
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.operationFailed') })
    data.value.allowedComments = !data.value.allowedComments
  }
}

const content = ref<HTMLElement | null>(null)

const progress = shallowRef<number>(0)

const progressBarColor = computed(() =>
  clientSite?.theme && Object.keys(themes).includes(clientSite.theme) ? themes[clientSite.theme] : themes.blue,
)

const handleContentScroll = () => {
  if (!content.value) return

  const { top, height } = content.value.getBoundingClientRect()
  const contentTop = top + window.scrollY
  const contentHeight = height

  const windowScrollY = window.scrollY
  const windowHeight = window.innerHeight

  const scrollableDistance = contentHeight - windowHeight
  if (scrollableDistance > 0) {
    const scrollProgress = Math.max(0, windowScrollY - contentTop + windowHeight / 2)
    progress.value = Math.min(100, (scrollProgress / scrollableDistance) * 100)
  } else progress.value = 0
}

const hasTags = computed(() => !!data.value?.tags?.length)

const debouncedSetStatus = useDebounceFn(async (id: string, status: ArticleStatus) => {
  try {
    await $fetch(`/api/articles/${id}`, { method: 'PATCH', body: { status } })
    await refresh()
    toast.success({
      message: $t('articles.status.changeSuccess', [
        status === 'draft' ? $t('articles.status.draft') : $t('articles.status.published'),
      ]),
    })
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('common.messages.statusChangeFailed') })
  }
}, 100)

const isSticky = shallowRef<boolean>(false)

const container = useTemplateRef('container')

const images = ref<Image[]>([])

const currentImageIndex = shallowRef<number>(0)

const lightboxVisible = shallowRef<boolean>(false)

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
    if (target.tagName !== 'IMG') return

    const img = target as HTMLImageElement
    const src = img.src
    const index = images.value.findIndex((i) => i.src === src)
    if (index === -1) return

    currentImageIndex.value = index
    lightboxVisible.value = true
  }

  setTimeout(() => extractImages(), 100)

  window.addEventListener('scroll', onScroll)
  content.value?.addEventListener('click', handleImageClick)

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
</script>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.prose p:empty::before {
  content: '\200B';
  display: inline-block;
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
  padding-top: 12px;
  padding-bottom: 6px;
  max-height: 600px;
  cursor: pointer !important;
  animation: fade-in 0.5s ease-out forwards;
}
</style>
