<template>
  <div class="editorial-card" :class="{ 'editorial-card--featured': isFeatured }">
    <div v-if="pending" class="animate-pulse">
      <div
        :class="{ 'h-64 lg:h-80 aspect-[3/2]': isFeatured, 'h-48 aspect-[3/2]': !isFeatured }"
        class="w-full bg-gray-200 dark:bg-gray-700"
      ></div>
      <div class="p-4 sm:p-5 space-y-2">
        <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        <div class="flex justify-between mt-3">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        </div>
        <div class="flex items-center gap-2 mt-3">
          <div class="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        </div>
      </div>
    </div>
    <template v-else>
      <NuxtLink
        class="editorial-card__media-link"
        :to="localePath({ name: 'clanky-slug', params: { slug: article?.slug } })"
        :aria-label="$t('common.readMoreAbout', { title: article?.title })"
      >
        <NuxtImg
          v-if="article?.imageUrl"
          :src="article?.imageUrl"
          :class="{
            'editorial-card__image editorial-card__image--featured': isFeatured,
            'editorial-card__image': !isFeatured,
          }"
          :alt="$t('articles.articleCard.imageAlt')"
          width="600"
          height="400"
          :sizes="isFeatured ? '100vw lg:66vw' : '100vw sm:50vw lg:33vw'"
          format="webp"
          :quality="75"
          :loading="isFeatured ? 'eager' : 'lazy'"
          :fetchpriority="isFeatured ? 'high' : 'auto'"
          :preload="isFeatured"
        />
        <div
          v-else
          :class="{ 'w-full h-48 lg:h-64 aspect-[3/2]': isFeatured, 'w-full h-32 aspect-[3/2]': !isFeatured }"
          class="bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg mb-4"
        >
          <Icon
            name="mdi:image-off"
            :class="{ 'w-16 h-16': isFeatured, 'w-12 h-12': !isFeatured }"
            class="text-gray-400"
          />
        </div>
      </NuxtLink>
      <div
        :class="{
          'editorial-card__tags editorial-card__tags--featured': isFeatured,
          'editorial-card__tags': !isFeatured,
        }"
      >
        <NuxtLink
          v-for="tag in tags?.slice(0, 3)"
          :key="tag.tag.id"
          :to="localePath({ name: 'clanky-slug', params: { slug: article?.slug } })"
          :class="{ 'px-3 py-1.5 text-sm': isFeatured, 'px-2 py-1 text-xs': !isFeatured }"
          class="editorial-card__tag"
        >
          {{ tag.tag.name }}
        </NuxtLink>
        <span
          v-if="tags && tags.length > 3"
          :class="{ 'px-3 py-1.5 text-sm': isFeatured, 'px-2.5 py-1 text-xs': !isFeatured }"
          class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full font-medium"
        >
          +{{ tags.length - 3 }}
        </span>
      </div>
      <div class="editorial-card__body" :class="{ 'editorial-card__body--featured': isFeatured }">
        <NuxtLink :to="localePath({ name: 'clanky-slug', params: { slug: article?.slug } })" class="no-underline">
          <h3
            :class="{ 'text-3xl lg:text-4xl font-bold': isFeatured, 'text-lg font-semibold': !isFeatured }"
            class="editorial-card__title"
          >
            {{ article?.title }}
          </h3>
        </NuxtLink>
        <div
          :class="{
            'editorial-card__excerpt editorial-card__excerpt--featured line-clamp-4': isFeatured,
            'editorial-card__excerpt line-clamp-3': !isFeatured,
          }"
        >
          {{ plainExcerpt }}
        </div>
        <NuxtLink
          v-if="article?.excerpt || article?.content"
          :to="localePath({ name: 'clanky-slug', params: { slug: article?.slug } })"
          :class="{
            'mt-4 inline-block text-lg font-medium text-blue-600 dark:text-blue-400 hover:underline transition duration-200':
              isFeatured,
            'mt-4 inline-block text-blue-600 dark:text-blue-400 font-medium hover:underline transition duration-200':
              !isFeatured,
          }"
        >
          {{ $t('common.readMore') }}
          <span class="sr-only">{{ $t('common.readMoreAbout', { title: article?.title }) }}</span>
        </NuxtLink>
        <div :class="{ 'mt-6 text-base': isFeatured, 'mt-4 text-sm': !isFeatured }" class="editorial-card__meta">
          <span>
            <span
              v-if="article?.createdAt"
              :class="{ 'text-red-500 font-semibold': isToday(new Date(article!.createdAt)) }"
            >
              {{ formatDate(new Date(article.createdAt)) }}
            </span>
            <span class="text-gray-400">·</span>
            {{ $t('articles.readingTime', [article?.readingTime ?? 5]) }}
          </span>
          <span v-tippy="$t('articles.articleCard.commentsAndLikesTooltip')" class="inline-flex items-center gap-1">
            <MessageCircle
              :class="{ 'w-5 h-5': isFeatured, 'w-4 h-4': !isFeatured }"
              class="hover:text-blue-600 dark:hover:text-blue-400 transition duration-200"
              :aria-label="$t('articles.articleCard.commentsAndLikesTooltip')"
            />
            {{ article?._count?.comments ?? 0 }}
            <span class="px-1 text-gray-400">·</span>
            <Heart
              :class="{ 'w-5 h-5': isFeatured, 'w-4 h-4': !isFeatured }"
              class="hover:text-blue-600 dark:hover:text-blue-400 transition duration-200"
              :aria-label="$t('articles.articleCard.commentsAndLikesTooltip')"
            />
            {{ article?._count?.reactions ?? 0 }}
            <span class="px-1 text-gray-400">·</span>
            <Eye
              :class="{ 'w-5 h-5': isFeatured, 'w-4 h-4': !isFeatured }"
              class="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition duration-200"
              :aria-label="$t('articles.articleCard.commentsAndLikesTooltip')"
            />
            {{ article?.views ?? 0 }}
          </span>
        </div>
        <div
          :class="{
            'editorial-card__author editorial-card__author--featured': isFeatured,
            'editorial-card__author': !isFeatured,
          }"
        >
          <NuxtLink
            :to="localePath({ name: 'autor-name', params: { name: article?.user?.username } })"
            class="flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg p-2 transition duration-200"
          >
            <NuxtImg
              v-if="article?.user?.avatarUrl"
              :src="article?.user.avatarUrl"
              :class="{ 'w-16 h-16': isFeatured, 'w-7 h-7': !isFeatured }"
              class="rounded-full object-cover border border-gray-200 dark:border-gray-700"
              :alt="$t('common.avatar.alt.author', [article?.user?.username || $t('articles.articleCard.noAuthor')])"
              width="64"
              height="64"
              format="webp"
              :quality="75"
              loading="lazy"
            />
            <span
              :class="{ 'text-lg font-semibold': isFeatured, 'font-medium': !isFeatured }"
              class="text-blue-600 dark:text-blue-400 transition duration-200"
            >
              {{ article?.user?.username ?? $t('articles.articleCard.noAuthor') }}
            </span>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isToday } from 'date-fns'
import { formatDate } from '~~/shared/utils'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import { MessageCircle, Heart, Eye } from 'lucide-vue-next'

const props = defineProps<{
  pending: boolean
  isFeatured?: boolean
  article?: {
    id: string
    slug: string
    title: string
    content?: string | null
    excerpt: string | null
    imageUrl: string | null
    createdAt: string
    readingTime: number | null
    views: number
    user: { id: string; username: string; avatarUrl: string | null } | null
    _count: { comments: number; reactions: number } | null
  }
  tags?: {
    tag: { id: string; name: string; slug: string }
  }[]
  index?: number
  selectedTag?: string
}>()

const localePath = useLocalePath()

const plainExcerpt = computed(() => {
  const content = props.article?.excerpt || props.article?.content || ''

  return (
    content.replace(/<[^>]+>/g, '').substring(0, props.isFeatured ? 275 : 100) +
    (content.length > (props.isFeatured ? 275 : 100) ? '...' : '')
  )
})
</script>

<style scoped>
.editorial-card {
  --card-ink: #17211b;
  --card-muted: #68736b;
  --card-accent: var(--client-accent, #2563eb);
  --card-line: rgb(23 33 27 / 12%);
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--card-line);
  border-radius: 1.35rem;
  background: #fbfaf6;
  box-shadow: 0 1px 0 rgb(255 255 255 / 80%) inset;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
}

.editorial-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--card-accent) 35%, transparent);
  box-shadow: 0 18px 45px rgb(23 33 27 / 10%);
}
.editorial-card__media-link {
  display: block;
  overflow: hidden;
}
.editorial-card__image {
  display: block;
  width: 100%;
  height: clamp(11.5rem, 20vw, 15rem);
  object-fit: cover;
  transition: transform 500ms cubic-bezier(0.2, 0.75, 0.2, 1);
}
.editorial-card__image--featured {
  height: clamp(17rem, 38vw, 31rem);
}
.editorial-card:hover .editorial-card__image {
  transform: scale(1.035);
}
.editorial-card__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 1.15rem 0;
}
.editorial-card__tags--featured {
  padding: 1.25rem clamp(1.15rem, 3vw, 2rem) 0;
}
.editorial-card__tag {
  padding: 0.35rem 0.65rem !important;
  border: 1px solid color-mix(in srgb, var(--card-accent) 22%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-accent) 8%, transparent);
  color: var(--card-accent);
  font-size: 0.7rem !important;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-decoration: none;
  text-transform: uppercase;
}
.editorial-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 1rem 1.15rem 1.2rem;
}
.editorial-card__body--featured {
  padding: clamp(1.25rem, 3vw, 2rem);
}
.editorial-card__title {
  color: var(--card-ink);
  line-height: 1.12;
  letter-spacing: -0.025em;
  text-wrap: balance;
  transition: color 160ms ease;
}
.editorial-card__title:hover {
  color: var(--card-accent);
}
.editorial-card__excerpt {
  margin-top: 0.7rem;
  color: var(--card-muted);
  font-size: 0.88rem;
  line-height: 1.6;
}
.editorial-card__excerpt--featured {
  margin-top: 1.15rem;
  font-size: clamp(0.95rem, 1.5vw, 1.08rem);
  line-height: 1.7;
}
.editorial-card__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  margin-top: auto;
  padding-top: 1.3rem;
  color: var(--card-muted);
  font-size: 0.75rem;
  border-top: 1px solid var(--card-line);
}
.editorial-card__author {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.8rem;
}
.editorial-card__author--featured {
  margin-top: 1rem;
}

:global(html.dark) .editorial-card {
  --card-ink: #f1eee7;
  --card-muted: #a9b2ab;
  --card-line: rgb(241 238 231 / 13%);
  background: #19221c;
}

@media (max-width: 600px) {
  .editorial-card,
  .editorial-card--featured {
    border-radius: 1.1rem;
  }
  .editorial-card__image,
  .editorial-card__image--featured {
    height: clamp(13rem, 63vw, 20rem);
  }
  .editorial-card__body,
  .editorial-card__body--featured {
    padding: 1rem 1rem 1.15rem;
  }
  .editorial-card__tags,
  .editorial-card__tags--featured {
    padding: 0.9rem 1rem 0;
  }
  .editorial-card__meta {
    flex-direction: row;
    align-items: center;
  }
}
</style>
