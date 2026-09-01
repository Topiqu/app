<template>
  <div class="@container h-full min-w-0">
    <UCard
      data-article-card
      :data-article-variant="variant"
      :data-article-layout="layout"
      class="h-full"
      :ui="{ body: 'h-full p-0 sm:p-0' }"
    >
      <article
        class="flex min-w-0 flex-col overflow-hidden"
        :class="[
          'h-full',
          layout === 'responsive-row' ? '@min-[36rem]:grid @min-[36rem]:grid-cols-[11rem_minmax(0,1fr)]' : '',
        ]"
      >
        <NuxtLink :to="articlePath" class="block shrink-0">
          <AppMedia
            :src="article.imageUrl"
            :alt="article.title"
            :fallbackBorder="false"
            :priority="variant === 'featured'"
            :aspectRatio="
              variant === 'featured' && !article.imageUrl
                ? '5 / 1'
                : variant === 'featured'
                  ? '3 / 2'
                  : variant === 'compact'
                    ? '5 / 2'
                    : '8 / 5'
            "
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

        <div :class="variant === 'compact' ? 'gap-3 p-4' : 'gap-5 p-5 sm:p-6'" class="flex min-h-0 flex-1 flex-col">
          <div v-if="normalizedTags.length" class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="tag in visibleTags"
              :key="tag.id"
              :to="localePath({ name: 'stitky-slug', params: { slug: tag.name } })"
              class="relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <UBadge color="primary" variant="soft">{{ tag.name }}</UBadge>
            </NuxtLink>
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
                  <UIcon name="mdi:calendar-outline" size="16" />
                  {{ formatDate(displayDate, locale) }}
                </span>
                <span v-if="article.readingTime" class="inline-flex whitespace-nowrap items-center gap-1">
                  <UIcon name="mdi:clock-outline" size="16" />
                  {{ $t('articles.readingTime', [article.readingTime]) }}
                </span>
              </span>
              <span class="inline-flex shrink-0 items-center gap-3 whitespace-nowrap">
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="mdi:comment-outline" size="16" />{{ comments }}</span
                >
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="mdi:heart-outline" size="16" />{{ reactions }}</span
                >
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="mdi:eye-outline" size="16" />{{ article.views ?? 0 }}</span
                >
                <span class="inline-flex items-center gap-1"
                  ><UIcon name="mdi:share-variant-outline" size="16" />{{ shares }}</span
                >
              </span>
            </div>

            <USeparator />
            <div class="flex min-h-9 items-center justify-between gap-3">
              <UserCard
                v-if="authorName && authorId"
                :user="{ id: authorId, username: authorName, avatarUrl: authorAvatar, bio: null }"
              />
              <span v-else />
              <div class="flex shrink-0 items-center gap-1">
                <slot name="actions" :article="article">
                  <UButton
                    :icon="localLiked ? 'mdi:heart' : 'mdi:heart-outline'"
                    :color="localLiked ? 'error' : 'neutral'"
                    variant="ghost"
                    square
                    :loading="liking"
                    :aria-label="$t('common.actions.like')"
                    @click="toggleLike"
                  />
                  <UButton
                    icon="mdi:share-variant-outline"
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

const {
  article,
  variant = 'standard',
  layout = 'column',
} = defineProps<{
  article: ArticleCardData
  variant?: ArticleCardVariant
  layout?: ArticleCardLayout
}>()
const localePath = useLocalePath()
const { locale } = useI18n()
const articlePath = computed(() => localePath({ name: 'clanky-slug', params: { slug: article.slug } }))
const authorName = computed(() => article.author?.name || article.user?.username || '')
const authorId = computed(() => article.author?.id || article.user?.id || '')
const authorAvatar = computed(() => article.author?.avatarUrl || article.user?.avatarUrl || null)
const displayDate = computed(() => article.publishedAt || article.createdAt)
const comments = computed(() => article._count?.comments ?? 0)
const reactionState = useState<Record<string, { liked: boolean; likes: number }>>('article-card-reactions', () => ({}))
const currentReaction = computed(
  () =>
    reactionState.value[article.id] ?? {
      liked: Boolean(article.likedByUser),
      likes: article._count?.reactions ?? article.likes ?? 0,
    },
)
const localLiked = computed(() => currentReaction.value.liked)
const reactions = computed(() => currentReaction.value.likes)
const shares = computed(() => article._count?.shares ?? article.shares ?? 0)
const plainExcerpt = computed(() => (article.excerpt || article.content || '').replace(/<[^>]+>/g, '').trim())
const normalizedTags = computed(() =>
  (article.tags ?? [])
    .map((item, index) => ({
      id: item.tag?.id || item.id || String(index),
      name: item.tag?.name || item.name || '',
    }))
    .filter((tag) => tag.name),
)
const tagLimit = computed(() => (variant === 'compact' ? 2 : 3))
const visibleTags = computed(() => normalizedTags.value.slice(0, tagLimit.value))
const liking = shallowRef(false)
const toast = useToast()

const toggleLike = async () => {
  if (liking.value) return
  liking.value = true
  try {
    // No visitor id: the endpoint resolves the session or the server-issued anon_session cookie.
    const result = await $fetch<{ liked: boolean; likes: number }>(`/api/articles/${article.id}/reaction`, {
      method: 'POST',
    })
    // Homepage filters can remount the same article in a different rail. Store the
    // response by article ID so every instance reads the same reaction state.
    reactionState.value = {
      ...reactionState.value,
      [article.id]: result,
    }
  } catch (e: any) {
    // Carries the server's reason, which for a like is usually the rate limit.
    toast.add({ color: 'error', title: $t('articles.comments.reactionFailed'), description: e?.data?.message })
  } finally {
    liking.value = false
  }
}

const shareArticle = async () => {
  const url = new URL(articlePath.value, window.location.origin).href
  try {
    if (navigator.share) await navigator.share({ title: article.title, url })
    else await navigator.clipboard.writeText(url)
    await $fetch(`/api/articles/${article.id}/share`, { method: 'POST', body: { platform: 'OTHER' } })
  } catch (error) {
    if ((error as DOMException)?.name !== 'AbortError') {
      toast.add({ color: 'error', title: $t('common.messages.operationFailed') })
    }
  }
}
</script>
