<template>
  <div v-if="data" class="min-h-screen p-8 md:p-12 relative">
    <div
      class="fixed top-0 hidden sm:block left-0 w-full bg-white dark:bg-neutral-900 shadow-md z-25"
      :class="isSticky ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'"
    >
      <div class="max-w-[1000px] mx-auto flex items-center justify-between px-4 py-4">
        <NuxtLink
          to="/admin"
          class="group flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg"
          :aria-label="$t('common.actions.backToList')"
        >
          <Icon name="mdi:arrow" class="w-6 h-6 mr-2 group-hover:-translate-x-1.5" />
          {{ $t('common.actions.backToList') }}
        </NuxtLink>
        <div class="flex flex-col items-end">
          <span v-if="data.series" class="text-xs font-bold text-blue-600 uppercase">
            {{ data.series.name }} ({{ data.series.current }}/{{ data.series.total }})
          </span>
          <h1 class="text-xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            {{ data.title }}
          </h1>
        </div>
      </div>
      <div
        v-if="isSticky"
        class="h-1 bg-gradient-to-r"
        :class="progressBarColor"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>

    <div ref="container" class="max-w-[1000px] mx-auto flex flex-col gap-8 px-4 sm:px-0">
      <nav v-if="breadcrumbs?.length" aria-label="Breadcrumb" class="w-full">
        <ol class="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <li v-for="(item, index) in breadcrumbs" :key="index" class="flex items-center gap-2">
            <Icon v-if="index > 0" name="mdi:chevron-right" class="w-4 h-4 text-gray-300 dark:text-gray-600" />
            <NuxtLink
              v-if="index < breadcrumbs.length - 1"
              :to="item.to"
              class="hover:text-blue-600 dark:hover:text-blue-400 font-medium"
            >
              {{ item.label }}
            </NuxtLink>
            <span v-else class="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-[400px]">
              {{ item.label }}
            </span>
          </li>
        </ol>
      </nav>

      <NuxtLink
        to="/admin"
        class="group flex items-center text-blue-700 hover:text-blue-900 font-semibold text-lg"
        :aria-label="$t('common.actions.backToList')"
      >
        <Icon name="mdi:arrow" class="w-6 h-6 mr-2 group-hover:-translate-x-1.5" />
        {{ $t('common.actions.backToList') }}
      </NuxtLink>

      <div v-if="data.series" class="flex items-center gap-3">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 uppercase"
        >
          <Icon name="mdi:bookshelf" class="w-3.5 h-3.5" />
          {{ $t('series.label', 'Série') }}
        </span>
        <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
          <span class="font-bold text-gray-900 dark:text-white">{{ data.series.name }}</span>
          <span class="mx-2">•</span>
          {{ $t('series.part', 'Část') }} {{ data.series.current }} / {{ data.series.total }}
        </span>
      </div>

      <h1
        class="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent leading-tight mb-3"
      >
        {{ data.title }}
      </h1>

      <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
        <UserPicture :url="data.user?.avatarUrl" :size="'md'" :name="data.user.username" />
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <NuxtLink
              :to="localePath({ name: 'autor-name', params: { name: data.user.username } })"
              class="font-medium text-[17px] text-blue-600 hover:text-blue-800"
            >
              {{ data.user.username }}
            </NuxtLink>
            <span class="italic text-gray-400 text-sm">• {{ $t('articles.articleCard.author') }}</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
            >
              <Icon name="mdi:account-group" class="w-3.5 h-3.5" />{{ data.followerCount ?? 0 }}
              {{ $t('profile.followers') }}
            </span>
            <button
              v-if="session?.user && session.user.id !== data.user.id"
              class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium text-gray-700 bg-white border-gray-200 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
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
        class="text-lg md:text-xl italic text-gray-700 dark:text-gray-200 leading-relaxed border border-gray-200 dark:border-gray-700 rounded-xl px-6 py-4 mb-3"
      >
        {{ data.excerpt }}
      </p>

      <NuxtImg
        v-if="data.imageUrl"
        :src="data.imageUrl"
        :alt="$t('articles.articleCard.imageAlt')"
        format="webp"
        quality="85"
        class="w-full max-h-[70vh] rounded-2xl object-contain bg-neutral-100 dark:bg-neutral-900 border border-gray-100/20"
        loading="lazy"
        placeholder
      />

      <div v-if="hasTags" class="mt-4 flex flex-wrap gap-2.5">
        <NuxtLink
          v-for="t in data.tags"
          :key="t.tag.slug"
          :to="localePath({ name: 'stitky-slug', params: { slug: t.tag.name } })"
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium text-gray-700 bg-white border-gray-200 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <Icon name="mdi:tag" class="w-4 h-4 text-gray-500 dark:text-gray-400" />{{ t.tag.name }}
        </NuxtLink>
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
                  'relative inline-flex h-5 w-10 items-center rounded-full',
                  data.allowedComments ? 'bg-blue-600' : 'bg-gray-500 dark:bg-gray-600',
                ]"
                @click="((data.allowedComments = !data.allowedComments), toggleComments())"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 rounded-full bg-white',
                    data.allowedComments ? 'translate-x-5' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>
            <span class="text-gray-300">|</span>
          </template>
          <div class="flex items-center gap-2">
            <Icon name="mdi:calendar" class="w-4 h-4" />{{ formatDate(data.createdAt) }}
          </div>
          <span class="text-gray-300">|</span>
          <div class="flex items-center gap-2">
            <Icon name="mdi:clock-outline" class="w-4 h-4" />{{ $t('articles.readingTime', [data.readingTime]) }}
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1">
            <span>{{ formatNumber(data.views) }}x {{ $t('stats.totalViews.title') }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Icon name="mdi:heart" class="w-4 h-4" :class="data.likedByUser ? 'text-red-500' : 'text-gray-500'" />
            <span>{{ formatNumber(data.likes) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Icon name="mdi:share-variant" class="w-4 h-4 text-gray-500" /><span>{{ formatNumber(data.shared) }}</span>
          </div>
          <LazyArticleModal
            v-if="session?.user.role === 'admin' && session.user.id === data.user.id"
            v-slot="{ open }"
            :article="data"
            hydrateOnInteraction
            @saved="refresh"
          >
            <button
              class="flex items-center justify-center w-9 h-9 bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800 rounded-full hover:from-blue-300 hover:to-blue-400"
              :aria-label="$t('common.actions.edit')"
              @click="open.value = true"
            >
              <Icon name="mdi:pencil" class="w-5 h-5" />
            </button>
          </LazyArticleModal>
        </div>
      </div>

      <div class="flex justify-end gap-4 mt-10">
        <button
          :aria-label="$t('common.actions.like')"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-red-400 dark:hover:border-red-400"
          @click="toggleLike"
        >
          <Icon name="mdi:heart" class="w-5 h-5" :class="{ 'text-red-500 dark:text-red-400': data.likedByUser }" />
        </button>
        <button
          :aria-label="$t('common.actions.copyLink')"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400 dark:hover:border-blue-500"
          @click="copyLink"
        >
          <Icon name="mdi:link-variant" class="w-5 h-5" />
        </button>
        <NuxtLink
          :to="`https://x.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          @click="share('TWITTER')"
        >
          <Icon name="mdi:twitter" class="w-5 h-5" />
        </NuxtLink>
        <NuxtLink
          :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
          target="_blank"
          class="w-10 h-10 flex items-center justify-center rounded-full border bg-white border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-[#374151] dark:border-[#4b5563] dark:text-gray-300 dark:hover:bg-[#2f3b4c] dark:hover:text-blue-400 dark:hover:border-blue-500"
          @click="share('LINKEDIN')"
        >
          <Icon name="mdi:linkedin" class="w-5 h-5" />
        </NuxtLink>
      </div>

      <div
        ref="content"
        class="max-w-[1000px] bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 text-[17px] md:text-lg leading-[1.8] text-gray-800 space-y-6 prose prose-gray prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl prose-h3:text-xl prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 dark:bg-neutral-900 dark:text-gray-200 dark:border-gray-700 dark:prose-invert dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 dark:prose-blockquote:border-gray-600"
      >
        <ArticleParsed :content="data.content" :articleId="data.id" />
      </div>

      <ArticleSeries v-if="data.series" :series="data.series" />

      <div class="w-full"><ClientSocials :clientSiteId="data.clientSiteId" class="flex gap-3 p-4" /></div>
      <VueEasyLightbox
        :visible="lightboxVisible"
        :imgs="images"
        :index="currentImageIndex"
        @hide="lightboxVisible = false"
      />
      <ArticleRelated :articles="relatedArticles!" :pending />
      <div v-if="data.sources?.length" class="w-full mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div
          class="flex items-center justify-between cursor-pointer text-gray-700 dark:text-gray-300 font-medium text-lg hover:text-blue-600 dark:hover:text-blue-400"
          @click="isOpen = !isOpen"
        >
          <div class="flex items-center gap-2">
            <Icon name="mdi:book-open-page-variant" class="w-5 h-5 text-blue-500 dark:text-blue-400" />
            {{ $t('articles.columns.sources') }} ({{ data.sources.length }})
          </div>
          <Icon name="mdi:chevron-down" class="w-5 h-5 text-gray-400" :class="{ 'rotate-180': isOpen }" />
        </div>
        <ul v-if="isOpen" class="mt-4 space-y-3 pl-1">
          <li v-for="source in data.sources" :key="source" class="flex items-center gap-3">
            <LazyNuxtImg
              :src="`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${source}&size=32`"
              class="w-5 h-5 rounded-sm"
              alt="favicon"
            />
            <NuxtLink
              :to="source"
              target="_blank"
              rel="noreferrer"
              class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline truncate max-w-[calc(100%-2.5rem)]"
            >
              {{ source }}
            </NuxtLink>
          </li>
        </ul>
      </div>
      <CommentSection :articleId="data.id" :commCount="data.commentCount || 0" :allowComments="data.allowedComments" />
      <ArticleTOC :content="data.content" />
    </div>
  </div>
  <Status v-else-if="status" :status="status" :message="status === 'error' ? `${error?.message}` : ''" />
</template>

<script setup lang="ts">
import type { ArticleStatus, User } from '@zenstackhq/runtime/models'

import { formatDate } from '~~/shared/utils'
import VueEasyLightbox from 'vue-easy-lightbox'
import { formatNumber } from '~~/shared/utils/number'

import { themes } from '~/composables/theme'

type Image = { src: string; alt?: string }
const items = useBreadcrumbItems()
const breadcrumbs = computed(() => {
  return items.value.map((item, index) => {
    if (index === 0) {
      return { ...item, label: $t('common.actions.home') }
    }

    if (index === items.value.length - 1) {
      return { ...item, label: data.value?.title }
    }

    if (item.label === 'Clanky') return { ...item, label: $t('articles.title'), to: '/' }

    return item
  })
})
const route = useRoute(),
  toast = useToast(),
  clipboard = useClipboard(),
  localePath = useLocalePath()

const reqUrl = useRequestURL()

const { data: session } = useAuth(),
  clientSite = await useClientSite()
const slug = computed(() => route.params.slug)

const { data, refresh, error, status } = await useFetch(`/api/articles/${slug.value}` as `/api/articles/:id`, {
  query: { clientSiteId: clientSite?.id },
})

const { data: follows, refresh: refreshFollows } = await useFetch<User[]>('/api/follows/followed')

const { data: relatedArticles, pending } = await useFetch(
  `/api/articles/${slug.value}/related?limit=3` as `/api/articles/:id/related`,
  { lazy: true, query: { clientSiteId: clientSite?.id } },
)

const canonicalUrl = computed(() => {
  if (!data.value?.slug) return ''
  const path = localePath({ name: 'clanky-slug', params: { slug: data.value.slug } })
  return `${reqUrl.protocol}//${reqUrl.host}${path}`
})

const articleDescription = computed(
  () => data.value?.excerpt?.slice(0, 160) || data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) || '',
)
const hasSeoPlan = computed(() => clientSite?.plan !== 'BASIC')

useSeoMeta({
  title: () => data.value?.title || 'Article',
  description: () => (hasSeoPlan.value ? articleDescription.value : undefined),
  ogTitle: () => (hasSeoPlan.value ? data.value?.title || 'Article' : undefined),
  ogDescription: () => (hasSeoPlan.value ? articleDescription.value : undefined),
  ogImage: () => (hasSeoPlan.value ? data.value?.imageUrl || undefined : undefined),
  ogUrl: () => (hasSeoPlan.value ? canonicalUrl.value : undefined),
  ogType: () => (hasSeoPlan.value ? 'article' : undefined),
  twitterCard: () => (hasSeoPlan.value ? 'summary_large_image' : undefined),
  twitterTitle: () => (hasSeoPlan.value ? data.value?.title || 'Article' : undefined),
  twitterDescription: () => (hasSeoPlan.value ? articleDescription.value : undefined),
  twitterImage: () => (hasSeoPlan.value ? data.value?.imageUrl || undefined : undefined),
})

useHead({
  link: [
    {
      rel: 'canonical',
      href: canonicalUrl,
    },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        hasSeoPlan.value && data.value
          ? JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: data.value?.title,
              description: articleDescription.value,
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': canonicalUrl.value,
              },
              image: data.value?.imageUrl ? [data.value.imageUrl] : [],
              datePublished: data.value?.createdAt,
              dateModified: data.value?.updatedAt,
              author: {
                '@type': 'Person',
                name: data.value?.user?.username || clientSite?.name,
              },
              publisher: {
                '@type': 'Organization',
                name: clientSite?.name,
                logo: {
                  '@type': 'ImageObject',
                  url: clientSite?.logoUrl,
                },
              },
            })
          : '',
      ),
    },
  ],
})

const isOpen = shallowRef(data.value?.sources && data.value.sources.length <= 5),
  isFollowing = shallowRef(follows.value?.some((f) => f.id === data.value?.userId) || false)

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
  await $fetch(`/api/articles/${data.value?.id}/share`, { method: 'POST', body: { platform } })
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
  const key = `liked-${data.value.slug}`,
    hasLiked = sessionStorage.getItem(key)
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

const content = useTemplateRef('content'),
  progress = shallowRef<number>(0)
const progressBarColor = computed(() =>
  clientSite?.theme && Object.keys(themes).includes(clientSite.theme) ? themes[clientSite.theme] : themes.blue,
)

const handleContentScroll = () => {
  if (!content.value) return
  const { top, height } = content.value.getBoundingClientRect(),
    contentTop = top + window.scrollY
  const scrollable = height - window.innerHeight
  if (scrollable > 0)
    progress.value = Math.min(
      100,
      Math.max(0, (window.scrollY - contentTop + window.innerHeight / 2) / scrollable) * 100,
    )
  else progress.value = 0
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

const isSticky = shallowRef<boolean>(false),
  container = useTemplateRef('container')
const images = ref<Image[]>([]),
  currentImageIndex = shallowRef<number>(0),
  lightboxVisible = shallowRef<boolean>(false)

onMounted(() => {
  const onScroll = () => {
    if (!container.value || !content.value) return
    isSticky.value = window.scrollY > 100
    handleContentScroll()
  }
  const extractImages = () => {
    if (!content.value) return
    images.value = Array.from(content.value.querySelectorAll('img')).map((i) => ({ src: i.src, alt: i.alt || '' }))
  }
  const handleImageClick = (e: Event) => {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG') return
    const i = target as HTMLImageElement
    const idx = images.value.findIndex((x) => x.src === i.src)
    if (idx === -1) return
    currentImageIndex.value = idx
    lightboxVisible.value = true
  }
  setTimeout(extractImages, 100)
  window.addEventListener('scroll', onScroll)
  content.value?.addEventListener('click', handleImageClick)
  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    content.value?.removeEventListener('click', handleImageClick)
  })
  if (!data.value?.id) return
  const key = `viewed-${data.value.id}`,
    last = sessionStorage.getItem(key),
    now = Date.now()
  if (last && now - Number(last) <= 1000) return
  try {
    $fetch(`/api/articles/${data.value.id}`, { method: 'PATCH', body: { views: data.value.views + 1 } })
    sessionStorage.setItem(key, now.toString())
  } catch (e: any) {
    console.error('Failed to update article views:', e)
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
.prose p img {
  padding-top: 12px;
  padding-bottom: 6px;
  max-height: 600px;
  cursor: pointer !important;
  animation: fade-in 0.5s ease-out forwards;
}
</style>
