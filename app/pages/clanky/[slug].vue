<template>
  <div v-if="data" class="min-h-screen p-8 md:p-12 relative">
    <div class="bg-red-500 text-white p-4 font-bold">
      TEST PROXY: {{ base64Bg ? base64Bg.substring(0, 50) + '...' : 'PROXY NULL' }}
    </div>
    <ArticleHeaderSticky
      :isSticky="isSticky"
      :progress="progress"
      :title="data.title"
      :likedByUser="data.likedByUser"
      :series="data.series && data.series.name ? (data.series as any) : undefined"
      :clientTheme="clientSite?.theme"
      @like="toggleLike"
    />

    <div class="max-w-[1000px] mx-auto relative">
      <div ref="container" class="w-full flex flex-col gap-8 px-4 sm:px-0 pt-4">
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
              <span
                v-else
                class="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-[400px]"
              >
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

        <ArticleHeaderHero
          :title="data.title"
          :author="data.user"
          :followerCount="data.followerCount || 0"
          :isFollowing="isFollowing"
          :showFollowButton="!!session?.user && session.user.id !== data.user.id"
          :excerpt="data.excerpt"
          :imageUrl="data.imageUrl"
          :series="data.series && data.series.name ? (data.series as any) : undefined"
          @follow="toggleFollow"
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

        <ArticleActionsBar
          :article="data"
          :isAdmin="session?.user?.role === 'admin' && session.user.id === data.user.id"
          :onStatusUpdate="debouncedSetStatus"
          @toggleComments="toggleComments"
          @refresh="refresh"
        />

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
            @click="copyLink(fullUrl)"
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

        <ArticleSeries v-if="data.series && data.series.name" :series="data.series as any" />
        <div
          class="mt-8 flex flex-col items-start justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row sm:items-center dark:border-gray-800"
        >
          <div class="flex shrink-0 items-center">
            <ClientSocials :clientSiteId="data.clientSiteId" class="flex gap-2 text-gray-400 dark:text-gray-500" />
          </div>
          <LazyArticleFeedback :articleId="data.id" class="w-full sm:max-w-xl" />
        </div>

        <LazyArticleLightbox
          v-if="lightboxVisible"
          :visible="lightboxVisible"
          :images="images"
          :index="currentImageIndex"
          @hide="lightboxVisible = false"
        />
        <LazyArticleRelated :articles="relatedArticles!" :pending="pending" />

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

        <LazyCommentSection
          :articleId="data.id"
          :commCount="data.commentCount || 0"
          :allowComments="data.allowedComments"
        />
      </div>
      <ArticleTOC :content="data.content" />
    </div>
  </div>
  <Status v-else-if="status" :status="status" :message="status === 'error' ? `${error?.message}` : ''" />
</template>

<script setup lang="ts">
import type { User } from '@zenstackhq/runtime/models'

const route = useRoute()
const toast = useToast()
const localePath = useLocalePath()
const reqUrl = useRequestURL()

const { data: session } = useAuth()
const clientSite = await useClientSite()
const slug = computed(() => route.params.slug as string)

const { data, refresh, error, status } = await useFetch(`/api/articles/${slug.value}` as `/api/articles/:id`, {
  query: { clientSiteId: clientSite?.id },
})

const { data: follows, refresh: refreshFollows } = await useFetch<User[]>('/api/follows/followed')

const { data: relatedArticles, pending } = await useFetch(() => `/api/articles/${slug.value}/related`, {
  lazy: true,
  query: { limit: 3, clientSiteId: clientSite?.id },
})

const canonicalUrl = computed(() => {
  if (!data.value?.slug) return ''
  return `${reqUrl.protocol}//${reqUrl.host}${localePath({ name: 'clanky-slug', params: { slug: data.value.slug } })}`
})

useArticleSeo(data, clientSite, canonicalUrl)

const hasSeoPlan = computed(() => clientSite?.plan !== 'BASIC')
const articleDescription = computed(
  () => data.value?.excerpt?.slice(0, 160) || data.value?.content?.replace(/<[^>]+>/g, '').slice(0, 160) || '',
)
const ogDescription = computed(() => {
  const text = articleDescription.value || ''
  return (
    text
      .slice(0, 100)
      .replace(/[\n\r]+/g, ' ')
      .trim() + '...'
  )
})

const { data: base64Bg } = await useAsyncData(
  `og-proxy-bg-${data.value?.id}`,
  async () => {
    if (!data.value?.imageUrl) return undefined
    try {
      const proxy = `/api/og-proxy?url=${encodeURIComponent(data.value.imageUrl)}`
      const response = await $fetch<{ success: boolean; dataUrl: string }>(proxy)

      return response.dataUrl
    } catch (e) {
      console.error('OG Proxy fetch error:', e)
      return undefined
    }
  },
  { server: true },
)

const ogImageOptions = computed(() => {
  const article = data.value

  if (hasSeoPlan.value && article) {
    return {
      title: article.title || 'Article',
      description: ogDescription.value,
      siteName: clientSite?.name || 'Blog',
      siteLogo: clientSite?.logoUrl || undefined,
      authorName: article.user?.username,
      authorImage: article.user?.avatarUrl || undefined,
      readingTime: article.readingTime ? $t('articles.readingTime', [article.readingTime]) : undefined,
      backgroundImage: base64Bg.value || article.imageUrl || undefined,
      isPremium: true,
    }
  }

  return {
    title: article?.title || 'Article',
    siteName: 'Topiqu',
    authorName: article?.user?.username,
    backgroundImage: base64Bg.value || article?.imageUrl || undefined,
    isPremium: false,
  }
})

defineOgImageComponent('TopiquArticle', ogImageOptions)

const { getVisitorId, trackView } = useArticleTracking(computed(() => data.value?.id))

const { share, copyLink, toggleComments, debouncedSetStatus } = useArticleActions(data, refresh)

const isFollowing = shallowRef(follows.value?.some((f) => f.id === data.value?.userId) || false)
const toggleFollow = async () => {
  if (!session.value?.user || !data.value?.user.id) return toast.error({ message: $t('common.auth.loginPrompt') })
  try {
    if (isFollowing.value) {
      const response = await $fetch<{ success: true; followerCount: number }>(`/api/follows/${data.value.user.id}`, {
        method: 'DELETE',
      })
      isFollowing.value = false
      if (data.value) data.value.followerCount = response.followerCount ?? 0
      toast.success({ message: $t('common.messages.successGeneral') })
    } else {
      const response = await $fetch<{ followerCount: number }>(`/api/follows/`, {
        method: 'POST',
        body: { followedId: data.value.user.id },
      })
      isFollowing.value = true
      if (data.value) data.value.followerCount = response.followerCount ?? 0
      toast.success({ message: $t('profile.messages.followSuccess', [data.value.user.username]) })
    }
    await refreshFollows()
  } catch (e: unknown) {
    const err = e as { data?: { statusCode?: number; message?: string } }
    if (err.data?.statusCode === 409) {
      isFollowing.value = true
      const response = await $fetch<{ followerCount: number }>(`/api/follows/`, {
        method: 'POST',
        body: { followedId: data.value?.user.id },
      })
      if (data.value) data.value.followerCount = response.followerCount ?? 0
    } else {
      toast.error({
        message:
          err.data?.message ||
          (isFollowing.value ? $t('profile.messages.profileUpdateError') : $t('profile.messages.followFailed')),
      })
    }
  }
}

const toggleLike = async () => {
  if (!data.value?.slug) return
  let visitorId = null
  if (!session.value?.user.id) {
    visitorId = await getVisitorId()
  }

  const key = `liked-${data.value.slug}`
  const hasLiked = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null
  if (hasLiked && !session.value?.user.id) sessionStorage.removeItem(key)

  try {
    const res = await $fetch<{ liked: boolean; likes: number }>(`/api/articles/${data.value.id}/reaction`, {
      method: 'POST',
      body: { visitorId },
    })

    if (data.value) {
      data.value.likedByUser = res.liked
      data.value.likes = res.likes
      triggerRef(data)
    }

    if (res.liked && !session.value?.user.id) sessionStorage.setItem(key, 'true')
    else if (!res.liked && !session.value?.user.id) sessionStorage.removeItem(key)
  } catch {
    toast.error({ message: $t('articles.comments.reactionFailed') })
    if (hasLiked && !session.value?.user.id) sessionStorage.setItem(key, 'true')
  }
}

const isOpen = shallowRef(data.value?.sources && data.value.sources.length <= 5)
const hasTags = computed(() => !!data.value?.tags?.length)
const fullUrl = computed(() => (import.meta.client ? window.location.href : ''))
const items = useBreadcrumbItems()
const breadcrumbs = computed(() => {
  return items.value.map((item, index) => {
    if (index === 0) return { ...item, label: $t('common.actions.home') }
    if (index === items.value.length - 1) return { ...item, label: data.value?.title }
    if (item.label === 'Clanky') return { ...item, label: $t('articles.title'), to: '/' }
    return item
  })
})

const isSticky = shallowRef(false)
const progress = shallowRef(0)
const container = useTemplateRef('container')
const content = useTemplateRef('content')

const handleContentScroll = () => {
  if (!content.value) return
  const { top, height } = content.value.getBoundingClientRect()
  const contentTop = top + window.scrollY
  const scrollable = height - window.innerHeight
  if (scrollable > 0)
    progress.value = Math.min(
      100,
      Math.max(0, (window.scrollY - contentTop + window.innerHeight / 2) / scrollable) * 100,
    )
  else progress.value = 0
}

type Image = { src: string; alt?: string }
const images = ref<Image[]>([])
const currentImageIndex = shallowRef(0)
const lightboxVisible = shallowRef(false)

onMounted(() => {
  trackView()

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

  if (data.value?.slug && !session.value?.user.id) {
    const likeKey = `liked-${data.value.slug}`
    const hasLikedLocal = sessionStorage.getItem(likeKey)
    if (hasLikedLocal && !data.value.likedByUser) {
      data.value.likedByUser = true
    }
  }

  setTimeout(extractImages, 100)
  window.addEventListener('scroll', onScroll)
  content.value?.addEventListener('click', handleImageClick)

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    content.value?.removeEventListener('click', handleImageClick)
  })
})
</script>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.4s ease,
    transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.prose p {
  line-height: 1.8;
}
.prose p:empty::before {
  content: '\200B';
  display: inline-block;
}
.prose p img {
  border-radius: 0.75rem;
  padding-top: 12px;
  padding-bottom: 6px;
  max-height: 600px;
  cursor: pointer !important;
  opacity: 0;
  animation: fade-in-image 0.6s ease-out forwards;
}
@keyframes fade-in-image {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dark ::-webkit-scrollbar-thumb {
  background: #475569;
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
