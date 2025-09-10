<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300"
    :class="{ 'lg:col-span-2': isFeatured }"
  >
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
    <div
      v-else
      v-motion
      :initial="{ opacity: 0, y: 50 }"
      :visibleOnce="{ opacity: 1, y: 0, transition: { duration: 500, delay: index! * 100 } }"
    >
      <NuxtLink :to="`/clanky/${article?.slug}`" class="block">
        <NuxtImg
          v-if="article?.imageUrl"
          :src="article?.imageUrl"
          :class="{
            'w-full h-60 lg:h-80 aspect-[3/2] object-cover hover:scale-[1.02] hover:rotate-1 transition duration-500':
              isFeatured,
            'w-full h-48 aspect-[3/2] object-cover rounded-lg mb-4 hover:blur-[1px] transition duration-500':
              !isFeatured,
          }"
          :alt="$t('articles.articleCard.imageAlt')"
        />
        <div
          v-else
          :class="{ 'w-full h-48 lg:h-64 aspect-[3/2]': isFeatured, 'w-full h-32 aspect-[3/2]': !isFeatured }"
          class="bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg mb-4"
        >
          <Icon name="image" :class="{ 'w-16 h-16': isFeatured, 'w-12 h-12': !isFeatured }" class="text-gray-400" />
        </div>
      </NuxtLink>
      <div
        :class="{
          'flex flex-wrap gap-2 mt-3 ml-6': isFeatured,
          'flex flex-wrap items-center gap-2 mt-2 ml-3 sm:ml-4': !isFeatured,
        }"
      >
        <NuxtLink
          v-for="tag in tags?.slice(0, 3)"
          :key="tag.tag.id"
          :to="`/stitky/${tag.tag.slug}`"
          :class="{ 'px-3 py-1.5 text-sm': isFeatured, 'px-2 py-1 text-xs': !isFeatured }"
          class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-800 hover:scale-95 transition duration-200 no-underline"
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
      <div :class="{ 'p-6': isFeatured, 'p-4 sm:p-5': !isFeatured }">
        <NuxtLink :to="`/clanky/${article?.slug}`" class="no-underline">
          <h3
            :class="{ 'text-3xl lg:text-4xl font-bold': isFeatured, 'text-lg font-semibold': !isFeatured }"
            class="hover:text-blue-600 dark:hover:text-blue-400 transition duration-200"
          >
            {{ article?.title }}
          </h3>
        </NuxtLink>
        <div
          :class="{
            'mt-8 text-base sm:text-lg line-clamp-4 text-gray-600 dark:text-gray-300 leading-7': isFeatured,
            'mt-2 text-sm line-clamp-3 text-gray-600 dark:text-gray-300 leading-5': !isFeatured,
          }"
        >
          {{ plainExcerpt }}
        </div>
        <NuxtLink
          v-if="article?.excerpt || article?.content"
          :to="`/clanky/${article?.slug}`"
          :class="{
            'mt-4 inline-block text-lg font-medium text-blue-600 dark:text-blue-400 hover:underline transition duration-200':
              isFeatured,
            'mt-4 inline-block text-blue-600 dark:text-blue-400 font-medium hover:underline transition duration-200':
              !isFeatured,
          }"
        >
          {{ $t('articles.articleCard.readMore') }}
        </NuxtLink>
        <div
          :class="{ 'mt-6 text-base': isFeatured, 'mt-4 text-sm': !isFeatured }"
          class="flex flex-col sm:flex-row justify-between gap-4"
        >
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
            'flex flex-col items-start gap-2 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700': isFeatured,
            'flex items-center gap-3 mt-3': !isFeatured,
          }"
        >
          <NuxtLink
            :to="`/autor/${article?.user?.username}`"
            class="flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg p-2 transition duration-200"
          >
            <NuxtImg
              v-if="article?.user?.avatarUrl"
              :src="article?.user.avatarUrl"
              :class="{ 'w-16 h-16': isFeatured, 'w-7 h-7': !isFeatured }"
              class="rounded-full object-cover border border-gray-200 dark:border-gray-700"
              :alt="
                $t('articles.articleCard.authorAvatarAlt', [
                  article?.user?.username || $t('articles.articleCard.noAuthor'),
                ])
              "
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { isToday } from 'date-fns'
import { formatDate } from '~~/shared/utils'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import { MessageCircle, Heart, Eye } from 'lucide-vue-next'
// const pending = true
const props = defineProps<{
  pending: boolean
  isFeatured?: boolean
  article?: {
    id: string
    slug: string
    title: string
    content: string | null
    excerpt: string | null
    imageUrl: string | null
    createdAt: string
    readingTime: number | null
    views: number
    user: { id: string; username: string; email: string; avatarUrl: string | null } | null
    _count: { comments: number; reactions: number } | null
  }
  tags?: {
    tag: { id: string; name: string; slug: string }
  }[]
  index?: number
  selectedTag?: string
}>()

const plainExcerpt = computed(() => {
  const content = props.article?.excerpt || props.article?.content || ''
  return (
    content.replace(/<[^>]+>/g, '').substring(0, props.isFeatured ? 275 : 100) +
    (content.length > (props.isFeatured ? 275 : 100) ? '...' : '')
  )
})
</script>
