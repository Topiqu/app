<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg transition duration-300 relative"
    :class="{ 'lg:col-span-2': isFeatured, 'p-5': !isFeatured, 'overflow-hidden': isFeatured }"
  >
    <div v-if="pending" class="animate-pulse">
      <div
        :class="{ 'h-64 lg:h-80': isFeatured, 'h-36': !isFeatured }"
        class="w-full bg-gray-200 dark:bg-gray-700 rounded-lg"
      ></div>
      <div v-if="!isFeatured" class="mt-4 space-y-2">
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
      <div v-else class="p-6 animate-pulse space-y-2">
        <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-4"></div>
        <div class="flex items-center gap-2 mt-4">
          <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
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
        class="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/20 dark:to-blue-600/5 opacity-0 group-hover:opacity-50 transition duration-300 z-10"
      ></div>
      <NuxtImg
        v-if="article?.imageUrl"
        :src="article?.imageUrl"
        :class="{
          'w-full h-64 lg:h-80 object-cover group-hover:scale-[1.02] group-hover:rotate-1': isFeatured,
          'w-full h-36 object-cover rounded-lg mb-4 group-hover:blur-[1px]': !isFeatured,
        }"
        class="transition duration-500 relative z-20"
        :alt="isFeatured ? 'Featured' : 'Doporučený'"
      />
      <div
        v-else
        :class="{ 'w-full h-64 lg:h-80': isFeatured, 'w-full h-36': !isFeatured }"
        class="bg-gray-100 dark:bg-gray-700 flex items-center justify-center rounded-lg mb-4"
      >
        <Icon name="image" :class="{ 'w-16 h-16': isFeatured, 'w-12 h-12': !isFeatured }" class="text-gray-400" />
      </div>
      <div :class="{ 'p-6': isFeatured, 'p-5': !isFeatured }" class="relative z-20">
        <h3
          :class="{ 'text-xl lg:text-2xl': isFeatured, 'text-lg': !isFeatured }"
          class="font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200"
        >
          {{ article?.title }}
        </h3>
        <div v-if="isFeatured" class="mt-3 line-clamp-3 text-base" v-html="article?.content"></div>
        <div
          v-else
          class="mt-2 truncate text-sm text-gray-600 dark:text-gray-300"
          v-html="article?.content?.substring(0, 50) + (article?.content?.length! > 50 ? '...' : '')"
        ></div>
        <div class="mt-4 flex flex-col sm:flex-row justify-between text-sm gap-3">
          <span>{{ formatDate(article?.createdAt ?? undefined) }} · {{ article?.readingTime ?? 5 }} min čtení</span>
          <span v-tippy="isFeatured ? 'Komentáře a reakce' : 'Komentáře'">
            <MessageCircle class="w-4 h-4 inline mr-1" />{{ article?._count?.comments ?? 0 }}
            <template v-if="isFeatured">
              · <Heart class="w-4 h-4 inline mr-1" />{{ article?._count?.reactions ?? 0 }}
            </template>
          </span>
        </div>
        <div class="mt-3 flex items-center gap-3 text-sm">
          <NuxtImg
            v-if="article?.user?.avatarUrl"
            :src="article?.user.avatarUrl"
            :class="{ 'w-8 h-8': isFeatured, 'w-7 h-7': !isFeatured }"
            class="rounded-full object-cover border border-gray-200 dark:border-gray-700 transition duration-300 relative z-20"
            alt="Autor"
          />
          <span class="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition duration-200">
            {{ article?.user?.username ?? 'Není uveden' }}
          </span>
        </div>
        <div v-if="tags && tags.length" class="flex flex-wrap gap-2 mt-3 relative z-20">
          <button
            v-for="tag in tags.slice(0, 3)"
            :key="tag.tag.id"
            class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-full font-medium hover:bg-blue-200 dark:hover:bg-blue-800 hover:scale-95 transition duration-200"
          >
            {{ tag.tag.name }}
          </button>
          <span v-if="tags.length > 3" class="text-xs">...</span>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import { MessageCircle, Heart } from 'lucide-vue-next'

defineProps<{
  pending: boolean
  isFeatured?: boolean
  article?: {
    id: string
    slug: string
    title: string
    content: string | null
    imageUrl: string | null
    createdAt: string
    readingTime: number
    user: { avatarUrl: string | null; username: string | null }
    _count: { comments: number; reactions: number } | null
  }
  tags?: {
    tag: { id: string; name: string; slug: string }
  }[]
  index?: number
  selectedTag?: string
}>()
</script>
