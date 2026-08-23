<template>
  <div class="@container h-full min-w-0 [&>*]:h-full">
    <UCard data-article-card :data-article-variant="variant" :data-article-layout="layout">
      <article
        class="flex h-full min-w-0 flex-col gap-5 overflow-hidden"
        :class="layout === 'responsive-row' ? '@min-[36rem]:grid @min-[36rem]:grid-cols-[11rem_minmax(0,1fr)]' : ''"
      >
        <NuxtLink :to="articlePath" class="block shrink-0">
          <AppMedia
            :src="article.imageUrl"
            :alt="article.title"
            :priority="variant === 'featured'"
            :aspectRatio="variant === 'featured' ? '3 / 2' : '8 / 5'"
            :sizes="
              variant === 'featured'
                ? '100vw lg:55vw'
                : layout === 'responsive-row'
                  ? '100vw (min-width: 576px) 176px'
                  : '100vw sm:50vw lg:33vw'
            "
            :containerClass="layout === 'responsive-row' ? 'w-full @min-[36rem]:h-full' : 'w-full'"
          />
        </NuxtLink>

        <div :class="variant === 'compact' ? 'gap-3' : 'gap-5'" class="flex min-h-0 flex-1 flex-col">
          <div v-if="normalizedTags.length" class="flex flex-wrap gap-2">
            <UBadge v-for="tag in visibleTags" :key="tag.id" color="primary" variant="soft">
              {{ tag.name }}
            </UBadge>
            <UBadge v-if="normalizedTags.length > tagLimit" color="neutral" variant="soft">
              +{{ normalizedTags.length - tagLimit }}
            </UBadge>
          </div>

          <div class="min-w-0 space-y-3">
            <NuxtLink :to="articlePath">
              <h2
                :class="
                  variant === 'featured' ? 'text-2xl sm:text-3xl' : variant === 'compact' ? 'text-base' : 'text-xl'
                "
                class="font-bold leading-snug tracking-tight text-highlighted"
                :title="article.title"
              >
                <span :class="variant === 'compact' ? 'line-clamp-2' : 'line-clamp-3'">{{ article.title }}</span>
              </h2>
            </NuxtLink>
            <p
              v-if="plainExcerpt"
              :class="variant === 'compact' ? 'line-clamp-2 text-sm' : 'line-clamp-3'"
              class="leading-relaxed text-muted"
            >
              {{ plainExcerpt }}
            </p>
          </div>

          <div class="mt-auto space-y-3 pt-1" data-article-footer>
            <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-muted">
              <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="inline-flex whitespace-nowrap items-center gap-1">
                  <UIcon name="i-mdi-calendar-outline" size="16" />
                  {{ formatDate(displayDate) }}
                </span>
                <span v-if="article.readingTime" class="inline-flex whitespace-nowrap items-center gap-1">
                  <UIcon name="i-mdi-clock-outline" size="16" />
                  {{ $t('articles.readingTime', [article.readingTime]) }}
                </span>
              </span>
              <span class="inline-flex shrink-0 items-center gap-3 whitespace-nowrap">
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="i-mdi-comment-outline" size="16" />{{ comments }}</span
                >
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="i-mdi-heart-outline" size="16" />{{ reactions }}</span
                >
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="i-mdi-eye-outline" size="16" />{{ article.views ?? 0 }}</span
                >
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="i-mdi-share-variant-outline" size="16" />{{ shares }}</span
                >
              </span>
            </div>

            <USeparator />
            <div class="flex min-h-9 items-center justify-between gap-3">
              <NuxtLink v-if="authorName" :to="authorPath" class="flex min-w-0 items-center gap-2">
                <AppMedia
                  :src="authorAvatar"
                  :alt="$t('common.avatar.alt.author', [authorName])"
                  :fallbackText="authorName"
                  aspectRatio="1 / 1"
                  sizes="32px"
                  containerClass="size-8 shrink-0 rounded-full"
                />
                <span class="truncate text-sm font-medium text-highlighted">{{ authorName }}</span>
              </NuxtLink>
              <span v-else />
              <div class="flex shrink-0 items-center gap-1">
                <slot name="actions" :article="article">
                  <UButton
                    :icon="localLiked ? 'i-mdi-heart' : 'i-mdi-heart-outline'"
                    :color="localLiked ? 'error' : 'neutral'"
                    variant="ghost"
                    square
                    :loading="liking"
                    :aria-label="$t('common.actions.like')"
                    @click="toggleLike"
                  />
                  <UButton
                    icon="i-mdi-share-variant-outline"
                    color="neutral"
                    variant="ghost"
                    square
                    :aria-label="$t('common.actions.share')"
                    @click="shareArticle"
                  />
                </slot>
              </div>
            </div>
          </div>
        </div>
      </article>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData, ArticleCardLayout, ArticleCardVariant } from '~~/shared/types/article'

import { formatDate } from '~~/shared/utils'

const props = withDefaults(
  defineProps<{ article: ArticleCardData; variant?: ArticleCardVariant; layout?: ArticleCardLayout }>(),
  {
    variant: 'standard',
    layout: 'column',
  },
)
const localePath = useLocalePath()
const articlePath = computed(() => localePath({ name: 'clanky-slug', params: { slug: props.article.slug } }))
const authorName = computed(() => props.article.author?.name || props.article.user?.username || '')
const authorAvatar = computed(() => props.article.author?.avatarUrl || props.article.user?.avatarUrl || null)
const authorPath = computed(() => localePath({ name: 'autor-name', params: { name: authorName.value } }))
const displayDate = computed(() => props.article.publishedAt || props.article.createdAt)
const comments = computed(() => props.article._count?.comments ?? 0)
const localLikes = shallowRef(props.article._count?.reactions ?? props.article.likes ?? 0)
const localLiked = shallowRef(Boolean(props.article.likedByUser))
const reactions = computed(() => localLikes.value)
const shares = computed(() => props.article._count?.shares ?? props.article.shares ?? 0)
const plainExcerpt = computed(() =>
  (props.article.excerpt || props.article.content || '').replace(/<[^>]+>/g, '').trim(),
)
const normalizedTags = computed(() =>
  (props.article.tags ?? [])
    .map((item, index) => ({
      id: item.tag?.id || item.id || String(index),
      name: item.tag?.name || item.name || '',
    }))
    .filter((tag) => tag.name),
)
const tagLimit = computed(() => (props.variant === 'compact' ? 2 : 3))
const visibleTags = computed(() => normalizedTags.value.slice(0, tagLimit.value))
const liking = shallowRef(false)
const { data: session } = useAuth()
const { getVisitorId } = useArticleTracking(computed(() => props.article.id))
const toast = useToast()

const toggleLike = async () => {
  if (liking.value) return
  liking.value = true
  try {
    const visitorId = session.value?.user.id ? null : await getVisitorId()
    const result = await $fetch<{ liked: boolean; likes: number }>(`/api/articles/${props.article.id}/reaction`, {
      method: 'POST',
      body: { visitorId },
    })
    localLiked.value = result.liked
    localLikes.value = result.likes
  } catch {
    toast.add({ color: 'error', title: $t('articles.comments.reactionFailed') })
  } finally {
    liking.value = false
  }
}

const shareArticle = async () => {
  const url = new URL(articlePath.value, window.location.origin).href
  try {
    if (navigator.share) await navigator.share({ title: props.article.title, url })
    else await navigator.clipboard.writeText(url)
    await $fetch(`/api/articles/${props.article.id}/share`, { method: 'POST', body: { platform: 'OTHER' } })
  } catch (error) {
    if ((error as DOMException)?.name !== 'AbortError') {
      toast.add({ color: 'error', title: $t('common.messages.operationFailed') })
    }
  }
}
</script>
