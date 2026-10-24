<template>
  <div class="@container h-full min-w-0">
    <UCard
      data-article-card
      :data-article-variant="variant"
      :data-article-layout="layout"
      :variant="editorial ? 'editorial' : 'outline'"
      class="h-full"
      :ui="{ body: 'h-full p-0 sm:p-0' }"
    >
      <article
        class="flex min-w-0 flex-col"
        :class="[
          'h-full',
          !editorial && 'overflow-hidden',
          layout === 'responsive-row' ? '@min-[36rem]:grid @min-[36rem]:grid-cols-[11rem_minmax(0,1fr)]' : '',
        ]"
      >
        <div class="relative shrink-0">
          <NuxtLink :to="articlePath" :aria-label="article.title" class="block h-full">
            <AppMedia
              :src="article.imageUrl"
              :alt="editorial ? '' : article.title"
              :fallbackText="editorial ? article.title : undefined"
              :fallbackBorder="false"
              :priority="variant === 'featured'"
              :aspectRatio="
                editorial
                  ? '4 / 3'
                  : variant === 'featured' && !article.imageUrl
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
              :containerClass="
                editorial
                  ? 'w-full rounded-(--topiqu-surface-radius) bg-elevated'
                  : layout === 'responsive-row'
                    ? 'w-full @min-[36rem]:h-full'
                    : 'w-full'
              "
            />
          </NuxtLink>
          <div
            v-if="variant !== 'compact' || $slots.actions"
            class="absolute top-3 right-3 z-10 flex items-center gap-2"
          >
            <UButton
              v-if="variant !== 'compact' && !editorial && comments > 0"
              :to="`${articlePath}#comments`"
              color="neutral"
              variant="overlay"
              size="sm"
              square
              icon="mdi:comment-outline"
              :aria-label="$t('articles.comments.unit', comments)"
              :title="$t('articles.comments.unit', comments)"
            />
            <slot name="actions" :article="article">
              <ArticleLikeButton
                v-if="variant !== 'compact'"
                :liked="liked"
                :likes="reactions"
                :pending="reactionPending"
                iconOnly
                variant="overlay"
                @toggle="toggleReaction"
              />
              <UButton
                v-if="variant !== 'compact'"
                icon="mdi:share-variant-outline"
                color="neutral"
                variant="overlay"
                size="sm"
                square
                :aria-label="$t('common.actions.share')"
                :title="$t('common.actions.share')"
                @click="shareArticle"
              />
            </slot>
          </div>
        </div>

        <div
          :class="editorial ? 'gap-0 p-0' : variant === 'compact' ? 'gap-3 p-4' : 'gap-5 p-5 sm:p-6'"
          class="flex min-h-0 flex-1 flex-col"
        >
          <div v-if="!editorial && normalizedTags.length" class="flex flex-wrap gap-1.5">
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

          <div
            class="min-w-0"
            :class="editorial ? 'space-y-2 pt-4' : variant === 'compact' ? 'space-y-2' : 'space-y-3'"
          >
            <NuxtLink :to="articlePath" class="group">
              <component
                :is="editorial ? 'h3' : 'h2'"
                :class="
                  editorial
                    ? 'break-words text-balance text-lg group-hover:text-primary sm:text-xl'
                    : variant === 'featured'
                      ? 'text-2xl sm:text-3xl'
                      : variant === 'compact'
                        ? 'text-lg'
                        : 'text-xl'
                "
                class="font-bold leading-snug tracking-tight text-highlighted"
                :title="article.title"
              >
                <span :class="variant === 'compact' || editorial ? 'line-clamp-2' : 'line-clamp-3'">{{
                  article.title
                }}</span>
              </component>
            </NuxtLink>
            <p
              v-if="plainExcerpt"
              :class="
                editorial ? 'text-sm leading-6' : variant === 'compact' ? 'text-sm leading-relaxed' : 'leading-relaxed'
              "
              class="line-clamp-2 text-muted"
            >
              {{ plainExcerpt }}
            </p>
          </div>

          <footer
            :class="editorial ? 'pt-2 text-xs text-muted' : 'mt-auto border-t border-default pt-4'"
            data-article-footer
          >
            <AppTime v-if="editorial" :datetime="displayDate" preset="datetime" />
            <div v-else class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted">
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
              <span
                class="ml-auto inline-flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right"
              >
                <AppTime :datetime="displayDate" preset="date" />
                <template v-if="article.readingTime">
                  <span aria-hidden="true">·</span>
                  <span class="whitespace-nowrap">{{ $t('articles.readingTime', [article.readingTime]) }}</span>
                </template>
              </span>
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
const editorial = computed(() => variant === 'editorial')
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
