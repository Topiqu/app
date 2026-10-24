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
                    ? '16 / 9'
                    : '8 / 5'
            "
            :sizes="
              variant === 'featured'
                ? 'xs:100vw phone:100vw sm:100vw md:100vw lg:55vw xl:720px'
                : layout === 'responsive-row'
                  ? 'xs:100vw phone:100vw 576:176px'
                  : 'xs:100vw phone:100vw sm:50vw lg:33vw xl:420px'
            "
            :containerClass="layout === 'responsive-row' ? 'w-full @min-[36rem]:h-full' : 'w-full'"
          />
        </NuxtLink>

        <div :class="variant === 'compact' ? 'gap-3 p-4' : 'gap-5 p-5 sm:p-6'" class="flex min-h-0 flex-1 flex-col">
          <div v-if="normalizedTags.length" class="flex flex-wrap gap-1.5">
            <NuxtLink
              v-for="tag in visibleTags"
              :key="tag.id"
              :to="localePath({ name: 'stitky-slug', params: { slug: tag.slug } })"
              class="relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <UBadge color="neutral" variant="soft" size="md">{{ tag.name }}</UBadge>
            </NuxtLink>
            <UBadge v-if="variant !== 'compact' && normalizedTags.length > tagLimit" color="neutral" variant="soft">
              +{{ normalizedTags.length - tagLimit }}
            </UBadge>
          </div>

          <div class="min-w-0" :class="variant === 'compact' ? 'space-y-2' : 'space-y-3'">
            <NuxtLink :to="articlePath">
              <h2
                :class="variant === 'featured' ? 'text-2xl sm:text-3xl' : variant === 'compact' ? 'text-lg' : 'text-xl'"
                class="font-bold leading-snug tracking-tight text-highlighted"
                :title="article.title"
              >
                <span :class="variant === 'compact' ? 'line-clamp-2' : 'line-clamp-3'">{{ article.title }}</span>
              </h2>
            </NuxtLink>
            <p
              v-if="plainExcerpt"
              :class="variant === 'compact' ? 'text-sm' : ''"
              class="line-clamp-2 leading-relaxed text-muted"
            >
              {{ plainExcerpt }}
            </p>
          </div>

          <footer class="mt-auto space-y-3 pt-1" data-article-footer>
            <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <NuxtLink
                v-if="variant === 'compact' && authorName"
                :to="localePath({ name: 'autor-name', params: { name: authorName } })"
                class="inline-flex min-w-0 items-center gap-2 text-sm text-muted hover:text-highlighted"
              >
                <UserPicture :url="authorAvatar" :name="authorName" size="mn" />
                <span class="line-clamp-2 break-words">{{ authorName }}</span>
              </NuxtLink>
              <UserCard
                v-else-if="authorName && authorId"
                :user="{ id: authorId, username: authorName, avatarUrl: authorAvatar, bio: null }"
              />
              <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <AppTime :datetime="displayDate" preset="date" />
                <template v-if="article.readingTime">
                  <span aria-hidden="true">·</span>
                  <span class="whitespace-nowrap">{{ $t('articles.readingTime', [article.readingTime]) }}</span>
                </template>
              </span>
            </div>
            <div v-if="variant !== 'compact' || $slots.actions" class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="variant !== 'compact' && comments > 0"
                :to="`${articlePath}#comments`"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="mdi:comment-outline"
                :aria-label="$t('articles.comments.unit', comments)"
              >
                {{ comments }}
              </UButton>
              <div class="ml-auto flex flex-wrap items-center gap-2">
                <slot name="actions" :article="article">
                  <ArticleLikeButton
                    v-if="variant !== 'compact'"
                    :liked="liked"
                    :likes="reactions"
                    :pending="reactionPending"
                    @toggle="toggleReaction"
                  />
                  <UButton
                    v-if="variant !== 'compact'"
                    icon="mdi:share-variant-outline"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    :aria-label="$t('common.actions.share')"
                    @click="shareArticle"
                  />
                </slot>
              </div>
            </div>
          </footer>
        </div>
      </article>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ArticleCardData, ArticleCardLayout, ArticleCardVariant } from '~~/shared/types/article'

import slugify from 'slugify'

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
const articlePath = computed(() =>
  localePath({ name: 'clanky-slug', params: { slug: article.slug } }, article.language),
)
const authorName = computed(() => article.author?.name || article.user?.username || '')
const authorId = computed(() => article.author?.id || article.user?.id || '')
const authorAvatar = computed(() => article.author?.avatarUrl || article.user?.avatarUrl || null)
const displayDate = computed(() => article.publishedAt || article.createdAt)
const comments = computed(() => article._count?.comments ?? 0)
const {
  liked,
  likes: reactions,
  isPending: reactionPending,
  toggle: toggleReaction,
} = useArticleReaction(
  () => article.id,
  () => ({
    liked: Boolean(article.likedByUser),
    likes: article._count?.reactions ?? article.likes ?? 0,
  }),
)
const plainExcerpt = computed(() => articleExcerpt(article.excerpt, article.content))
const normalizedTags = computed(() =>
  (article.tags ?? [])
    .map((item, index) => ({
      id: item.tag?.id || item.id || String(index),
      name: item.tag?.name || item.name || '',
      slug: item.tag?.slug || item.slug || slugify(item.tag?.name || item.name || '', { lower: true, strict: true }),
    }))
    .filter((tag) => tag.name),
)
const tagLimit = computed(() => (variant === 'compact' ? 1 : 3))
const visibleTags = computed(() => normalizedTags.value.slice(0, tagLimit.value))
const toast = useToast()
const trackShare = useArticleShare()

const shareArticle = async () => {
  const url = new URL(articlePath.value, window.location.origin).href
  try {
    if (navigator.share) await navigator.share({ title: article.title, url })
    else await navigator.clipboard.writeText(url)
  } catch (error) {
    if ((error as DOMException)?.name !== 'AbortError') {
      toast.add({ color: 'error', title: $t('common.messages.operationFailed') })
    }
    return
  }
  await trackShare(article.id, 'OTHER')
}
</script>
