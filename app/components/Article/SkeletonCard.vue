<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition duration-300 relative group no-underline"
    :class="{ 'lg:col-span-2': isFeatured }"
  >
    <div v-if="pending" class="animate-pulse">
      <div
        :class="{ 'h-64 lg:h-80 aspect-[3/2]': isFeatured, 'h-48 aspect-[3/2]': !isFeatured }"
        class="w-full bg-gray-200 dark:bg-gray-700"
      ></div>
      <div v-if="!isFeatured" class="p-4 sm:p-5 space-y-2">
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
      <div v-else class="p-5 sm:p-6 space-y-2">
        <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-4"></div>
        <div class="flex items-center gap-2 mt-4">
          <div class="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        </div>
      </div>
    </div>
    <NuxtLink
      v-else
      v-motion
      :initial="{ opacity: 0, y: 50 }"
      :visibleOnce="{ opacity: 1, y: 0, transition: { duration: 500, delay: index! * 100 } }"
      :to="`/clanky/${article?.slug}`"
      class="group no-underline"
    >
      <div
        class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/10 opacity-0 group-hover:opacity-60 transition duration-300 z-10"
      ></div>
      <NuxtImg
        v-if="article?.imageUrl"
        :src="article?.imageUrl"
        :class="{
          'w-full h-60 lg:h-80 aspect-[3/2] object-cover group-hover:scale-[1.02] group-hover:rotate-1 transition duration-500 relative z-20':
            isFeatured,
          'w-full h-48 aspect-[3/2] object-cover rounded-lg mb-4 group-hover:blur-[1px] transition duration-500 relative z-20':
            !isFeatured,
        }"
        :alt="'Náhled článku'"
      />
      <div
        v-else
        :class="{ 'w-full h-48 lg:h-64 aspect-[3/2]': isFeatured, 'w-full h-32 aspect-[3/2]': !isFeatured }"
        class="bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg mb-4"
      >
        <Icon name="image" :class="{ 'w-16 h-16': isFeatured, 'w-12 h-12': !isFeatured }" class="text-gray-400" />
      </div>
      <div
        v-if="tags && tags.length"
        :class="{ 'flex flex-wrap gap-2 mt-3 ml-6 relative z-20': isFeatured }"
        class="flex flex-wrap items-center gap-2 mt-2 ml-3 sm:ml-4 relative z-20"
      >
        <button
          v-for="tag in tags.slice(0, 3)"
          :key="tag.tag.id"
          :class="{ 'px-3 py-1.5 text-sm': isFeatured, 'px-2 py-1 text-xs': !isFeatured }"
          class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-800 hover:scale-95 transition duration-200 border-none"
        >
          {{ tag.tag.name }}
        </button>
        <span
          v-if="tags.length > 3"
          :class="{ 'px-3 py-1.5 text-sm': isFeatured, 'px-2.5 py-1 text-xs': !isFeatured }"
          class="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full font-medium border-none"
        >
          +{{ tags.length - 3 }}
        </span>
      </div>
      <div :class="{ 'p-6': isFeatured, 'p-4 sm:p-5': !isFeatured }" class="relative z-20">
        <h3
          :class="{ 'text-3xl lg:text-4xl font-bold': isFeatured, 'text-lg font-semibold': !isFeatured }"
          class="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
        >
          {{ article?.title }}
        </h3>
        <div
          v-if="isFeatured"
          class="mt-4 text-base sm:text-lg line-clamp-4 text-gray-600 dark:text-gray-300"
          v-html="article?.excerpt || article?.content || ''"
        ></div>
        <div
          v-else
          class="mt-2 text-sm line-clamp-3 text-gray-600 dark:text-gray-300"
          v-html="
            article?.excerpt || article?.content?.substring(0, 50) + (article?.content?.length! > 50 ? '...' : '')
          "
        ></div>
        <div class="mt-4 flex flex-col sm:flex-row justify-between text-sm gap-4">
          <span>
            <span :class="{ 'text-red-500 font-semibold': isToday(article?.createdAt) }">
              {{ formatDate(article?.createdAt ?? undefined) }}
            </span>
            <span class="text-gray-400">·</span>
            {{ article?.readingTime ?? 5 }} min čtení
          </span>
          <span v-tippy="'Komentáře a lajky'" class="inline-flex items-center">
            <MessageCircle class="w-4 h-4 inline mr-1" aria-label="Komentáře" />
            <span class="sr-only">Počet komentářů:</span>{{ article?._count?.comments ?? 0 }}
            <span class="px-1 text-gray-400">·</span>
            <Heart class="w-4 h-4 inline mr-1" aria-label="Lajky" />
            <span class="sr-only">Počet lajků:</span>{{ article?._count?.reactions ?? 0 }}
            <span class="px-1 text-gray-400">·</span>
            <Eye class="w-4 h-4 inline mr-1 text-gray-500 dark:text-gray-400" aria-label="Zobrazení" />
            <span class="sr-only">Počet zobrazení:</span>
            <span class="text-gray-500 dark:text-gray-400">{{ article?.views ?? 0 }}</span>
          </span>
        </div>
        <div
          :class="{
            'flex flex-col items-start gap-2 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700': isFeatured,
            'flex items-center gap-3 mt-3': !isFeatured,
          }"
          class="relative z-20"
        >
          <NuxtImg
            v-if="article?.user?.avatarUrl"
            :src="article?.user.avatarUrl"
            :class="{ 'w-16 h-16': isFeatured, 'w-7 h-7': !isFeatured }"
            class="rounded-full object-cover border border-gray-200 dark:border-gray-700 transition duration-300"
            alt="Autor"
          />
          <span
            :class="{ 'text-lg font-semibold': isFeatured, 'font-medium': !isFeatured }"
            class="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
          >
            {{ article?.user?.username ?? 'Není uveden' }}
          </span>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import { MessageCircle, Heart, Eye } from 'lucide-vue-next'

defineProps<{
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
    readingTime: number
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

const isToday = (date?: string) => {
  if (!date) return false
  const today = new Date()
  const created = new Date(date)
  return (
    today.getFullYear() === created.getFullYear() &&
    today.getMonth() === created.getMonth() &&
    today.getDate() === created.getDate()
  )
}
</script>
