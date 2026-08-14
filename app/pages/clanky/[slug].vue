<template>
  <div v-if="data" class="min-h-[100dvh] px-4 py-8 sm:px-6 lg:px-8">
    <div class="mx-auto grid max-w-[var(--topiqu-article-width)] gap-10 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div class="flex min-w-0 flex-col gap-8 pt-4">
        <nav v-if="breadcrumbs?.length" :aria-label="$t('common.breadcrumbs')" class="w-full">
          <ol class="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden text-sm text-muted">
            <li
              v-for="(item, index) in breadcrumbs"
              :key="index"
              class="flex min-w-0 items-center gap-2"
              :class="index === breadcrumbs.length - 1 ? 'flex-1' : 'shrink-0'"
            >
              <UIcon v-if="index > 0" name="i-mdi-chevron-right" size="16" />
              <ULink v-if="index < breadcrumbs.length - 1" :to="item.to">
                {{ item.label }}
              </ULink>
              <UTooltip v-else :text="item.label">
                <span class="block min-w-0 truncate font-semibold text-highlighted">{{ item.label }}</span>
              </UTooltip>
            </li>
          </ol>
        </nav>

        <div ref="hero">
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
        </div>

        <div v-if="hasTags" class="mt-4 flex flex-wrap gap-2.5">
          <NuxtLink
            v-for="t in data.tags"
            :key="t.tag.slug"
            :to="localePath({ name: 'stitky-slug', params: { slug: t.tag.name } })"
            class="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <UBadge color="neutral" variant="soft" size="sm" icon="i-mdi-tag">{{ t.tag.name }}</UBadge>
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
          <UButton
            :color="data.likedByUser ? 'error' : 'neutral'"
            :variant="data.likedByUser ? 'soft' : 'ghost'"
            icon="i-mdi-heart"
            square
            :aria-label="$t('common.actions.like')"
            @click="toggleLike"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-mdi-link-variant"
            square
            :aria-label="$t('common.actions.copyLink')"
            @click="copyLink(fullUrl)"
          />
          <UButton
            :to="`https://x.com/share?text=${encodeURIComponent(data.title)}&url=${fullUrl}`"
            target="_blank"
            color="neutral"
            variant="ghost"
            icon="i-mdi-twitter"
            square
            aria-label="X"
            @click="share('TWITTER')"
          />
          <UButton
            :to="`https://www.linkedin.com/sharing/share-offsite/?url=${fullUrl}`"
            target="_blank"
            color="neutral"
            variant="ghost"
            icon="i-mdi-linkedin"
            square
            aria-label="LinkedIn"
            @click="share('LINKEDIN')"
          />
        </div>

        <article ref="content" class="article-content mx-auto w-full">
          <ArticleParsed :content="data.content" :articleId="data.id" />
        </article>

        <ArticleSeries v-if="data.series && data.series.name" :series="data.series as any" />
        <div
          class="mt-8 flex flex-col items-start justify-between gap-4 border-t border-default pt-8 sm:flex-row sm:items-center"
        >
          <div class="flex shrink-0 items-center">
            <ClientSocials :clientSiteId="data.clientSiteId" class="flex gap-2 text-muted" />
          </div>
          <LazyArticleFeedback :articleId="data.id" class="w-full sm:max-w-xl" />
        </div>

        <LazyArticleLightbox :sourceRef="content" />
        <LazyArticleRelated :articles="relatedArticles ?? []" :pending="pending" />

        <UCollapsible v-if="data.sources?.length" v-model:open="isOpen" class="mt-10 w-full">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-mdi-book-open-page-variant"
            :trailingIcon="isOpen ? 'i-mdi-chevron-up' : 'i-mdi-chevron-down'"
            :label="`${$t('articles.columns.sources')} (${data.sources.length})`"
            class="w-full"
          />
          <template #content>
            <ol class="mt-3 overflow-hidden rounded-[var(--topiqu-surface-radius)] border border-default bg-elevated">
              <li
                v-for="(source, index) in data.sources"
                :key="`${index}-${source}`"
                class="grid min-w-0 grid-cols-[1.5rem_1.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 p-3 not-last:border-b not-last:border-default"
              >
                <span class="text-right text-xs tabular-nums text-muted">{{ Number(index) + 1 }}</span>
                <AppMedia
                  :src="sourceFaviconUrl(source)"
                  :alt="''"
                  :fallbackText="presentSourceUrl(source).hostname"
                  aspectRatio="1 / 1"
                  fit="contain"
                  sizes="20px"
                  containerClass="size-5 shrink-0 rounded-sm"
                />
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-highlighted">{{ presentSourceUrl(source).hostname }}</p>
                  <p v-if="presentSourceUrl(source).path" class="truncate text-xs text-muted">
                    {{ presentSourceUrl(source).path }}
                  </p>
                </div>
                <UTooltip :text="source">
                  <UButton
                    v-if="presentSourceUrl(source).valid"
                    :to="source"
                    target="_blank"
                    rel="noreferrer"
                    square
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    icon="i-mdi-open-in-new"
                    :aria-label="source"
                  />
                </UTooltip>
              </li>
            </ol>
          </template>
        </UCollapsible>

        <LazyCommentSection
          :articleId="data.id"
          :commCount="data.commentCount || 0"
          :allowComments="data.allowedComments"
        />
      </div>
      <ArticleTOC />
    </div>
  </div>
  <Status v-else-if="status" :status="status" :message="status === 'error' ? `${error?.message}` : ''" />
</template>

<script setup lang="ts">
import type { User } from '@zenstackhq/runtime/models'

import { presentSourceUrl, sourceFaviconUrl } from '~/utils/sourcePresentation'

definePageMeta({ shell: 'publication' })

const route = useRoute()
const toast = useToast()
const localePath = useLocalePath()
const reqUrl = useRequestURL()

const { data: session } = useAuth()
const clientSite = await useClientSite()
const slug = computed(() => route.params.slug as string)

const { locale } = useI18n()

const { data, refresh, error, status } = await useFetch(`/api/articles/${slug.value}` as `/api/articles/:id`, {
  query: { clientSiteId: clientSite?.id, locale: locale.value },
})

const { data: follows, refresh: refreshFollows } = await useFetch<User[]>('/api/follows/followed')

const { data: relatedArticles, pending } = await useFetch(() => `/api/articles/${slug.value}/related`, {
  lazy: true,
  query: { limit: 3, clientSiteId: data.value?.clientSiteId },
})

const canonicalOrigin = `${import.meta.dev ? reqUrl.protocol : 'https:'}//${reqUrl.host.replace(/^www\./, '')}`

const primaryLocale = computed(() => clientSite?.language ?? 'en')

// Real alternates only exist once translations are PUBLISHED (source + each translation).
const alternates = computed<{ language: 'cs' | 'en'; slug: string }[]>(() => data.value?.alternates ?? [])
const hasTranslations = computed(() => alternates.value.length >= 2)

const alternateLinks = computed(() =>
  hasTranslations.value
    ? alternates.value.map((alt) => ({
        hreflang: alt.language,
        href: `${canonicalOrigin}${localePath({ name: 'clanky-slug', params: { slug: alt.slug } }, alt.language)}`,
      }))
    : [],
)

const canonicalUrl = computed(() => {
  if (!data.value?.slug) return ''
  // With real translations, each locale self-canonicalises; otherwise collapse the
  // duplicate i18n-alias URLs onto the primary-language path (mono-lingual mitigation).
  const lang = hasTranslations.value ? (data.value.language ?? primaryLocale.value) : primaryLocale.value
  return `${canonicalOrigin}${localePath({ name: 'clanky-slug', params: { slug: data.value.slug } }, lang)}`
})

useArticleSeo(data, clientSite, canonicalUrl, alternateLinks)

const ogImageOptions = computed(() => ({ backgroundImage: data.value?.imageUrl }))

defineOgImage('TopiquArticle', ogImageOptions.value)

const { getVisitorId, trackView } = useArticleTracking(computed(() => data.value?.id))

const { share, copyLink, toggleComments, debouncedSetStatus } = useArticleActions(data, refresh)

const isFollowing = shallowRef(follows.value?.some((f) => f.id === data.value?.userId) || false)
const toggleFollow = async () => {
  if (!session.value?.user || !data.value?.user.id)
    return toast.add({ color: 'error', title: $t('common.auth.loginPrompt') })
  try {
    if (isFollowing.value) {
      const response = await $fetch<{ success: true; followerCount: number }>(`/api/follows/${data.value.user.id}`, {
        method: 'DELETE',
      })
      isFollowing.value = false
      if (data.value) data.value.followerCount = response.followerCount ?? 0
      toast.add({ color: 'success', title: $t('common.messages.successGeneral') })
    } else {
      const response = await $fetch<{ followerCount: number }>(`/api/follows/`, {
        method: 'POST',
        body: { followedId: data.value.user.id },
      })
      isFollowing.value = true
      if (data.value) data.value.followerCount = response.followerCount ?? 0
      toast.add({ color: 'success', title: $t('profile.messages.followSuccess', [data.value.user.username]) })
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
      toast.add({
        color: 'error',
        title:
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
    toast.add({ color: 'error', title: $t('articles.comments.reactionFailed') })
    if (hasLiked && !session.value?.user.id) sessionStorage.setItem(key, 'true')
  }
}

const isOpen = shallowRef(data.value?.sources && data.value.sources.length <= 5)
const hasTags = computed(() => !!data.value?.tags?.length)
const requestUrl = useRequestURL()
const fullUrl = computed(() => new URL(route.fullPath, requestUrl.origin).href)
const breadcrumbs = computed(() => [
  { label: $t('common.actions.home'), to: localePath({ name: 'index' }) },
  { label: $t('articles.title'), to: `${localePath({ name: 'index' })}#articles` },
  { label: data.value?.title || '', to: route.fullPath },
])

const content = useTemplateRef<HTMLElement>('content')
const hero = useTemplateRef<HTMLElement>('hero')
useArticleScrollContext(content, hero)
const articleHeader = useArticleHeaderContext()
const articleLikeBus = useArticleLikeBus()

watchEffect(() => {
  if (!data.value) return
  articleHeader.value = {
    articleId: data.value.id,
    backTo: localePath({ name: 'index' }),
    canEdit: session.value?.user?.role === 'admin' && session.value.user.id === data.value.user.id,
    liked: Boolean(data.value.likedByUser),
    title: data.value.title,
  }
})

onMounted(() => {
  trackView()
  articleLikeBus.on(toggleLike)

  if (data.value?.slug && !session.value?.user.id) {
    const likeKey = `liked-${data.value.slug}`
    const hasLikedLocal = sessionStorage.getItem(likeKey)
    if (hasLikedLocal && !data.value.likedByUser) {
      data.value.likedByUser = true
    }
  }
})

onUnmounted(() => {
  articleLikeBus.off(toggleLike)
  articleHeader.value = null
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
  cursor: pointer;
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
