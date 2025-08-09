<template>
  <div class="mt-10">
    <div class="flex border-b border-gray-200 dark:border-neutral-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="relative px-5 py-3 text-sm font-medium transition-all duration-200 flex items-center gap-2"
        :class="
          activeTab === tab.id
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
        "
        @click="$emit('update:activeTab', tab.id)"
      >
        <Icon
          :name="tab.icon"
          class="w-4 h-4"
          :class="activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'"
        />
        {{ tab.label }}
        <span
          v-if="activeTab === tab.id"
          class="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600 dark:bg-indigo-400 rounded-t"
        ></span>
      </button>
    </div>

    <div class="mt-6 space-y-4">
      <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-10 text-sm">Načítání...</div>

      <div
        v-else-if="error"
        class="text-center p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
      >
        <p class="text-red-600 dark:text-red-400 font-medium">
          {{ error?.message || 'Chyba při načítání' }}
        </p>
      </div>

      <template v-else>
        <div v-if="activeTab === 'likedArticles'">
          <div v-if="!profile.likedArticles?.length" class="text-center text-gray-500 dark:text-gray-400 py-10 text-sm">
            Žádné lajknuté články.
          </div>
          <div v-else class="grid gap-4">
            <div
              v-for="article in profile.likedArticles"
              :key="article.id"
              class="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:shadow-md transition-all"
            >
              <NuxtImg
                v-if="article.imageUrl"
                :src="article.imageUrl"
                :alt="`Obrázek článku ${article.title}`"
                format="webp"
                quality="80"
                width="48"
                height="48"
                class="w-12 h-12 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-neutral-700"
              />
              <Icon v-else name="mdi:image-outline" class="w-12 h-12 text-gray-400 dark:text-gray-600" />
              <div class="flex flex-col gap-0.5">
                <NuxtLink
                  :to="`/clanky/${article.slug}`"
                  class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                >
                  {{ article.title }}
                </NuxtLink>
                <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Icon name="mdi:account-outline" class="w-3.5 h-3.5" />
                  <span>{{ article.authorUsername }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Publikováno: {{ formatDate(article.publishedAt || new Date().toISOString()) }}
                </p>
                <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div class="flex items-center gap-1">
                    <Icon name="mdi:thumb-up-outline" class="w-3.5 h-3.5" />
                    <span>{{ article.likesCount }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon name="mdi:eye-outline" class="w-3.5 h-3.5" />
                    <span>{{ article.views }}</span>
                  </div>
                </div>
                <div v-if="article.tags.length" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="tag in article.tags"
                    :key="tag"
                    class="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'comments'">
          <div v-if="!profile.comments?.length" class="text-center text-gray-500 dark:text-gray-400 py-10 text-sm">
            Žádné komentáře.
          </div>
          <div v-else class="grid gap-4">
            <div
              v-for="comment in profile.comments"
              :key="comment.id"
              class="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:shadow-md transition-all"
            >
              <p class="text-sm text-gray-700 dark:text-gray-300 mb-1">{{ comment.content }}</p>
              <NuxtLink
                :to="`/clanky/${comment.articleSlug}#comment-${comment.id}`"
                class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs flex items-center gap-1"
              >
                <Icon name="mdi:file-document-outline" class="w-3.5 h-3.5" />
                Článek: {{ comment.articleTitle }}
              </NuxtLink>
              <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Icon name="mdi:account-outline" class="w-3.5 h-3.5" />
                <span>{{ comment.authorUsername }}</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Vytvořeno: {{ formatDate(comment.createdAt) }}
              </p>
              <div class="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1 items-center">
                <div class="flex items-center gap-1">
                  <Icon name="mdi:thumb-up-outline" class="w-3.5 h-3.5" />
                  <span>{{ comment.likesCount }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="mdi:thumb-down-outline" class="w-3.5 h-3.5" />
                  <span>{{ comment.dislikesCount }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="mdi:eye-outline" class="w-3.5 h-3.5" />
                  <span>{{ comment.views }}</span>
                </div>
              </div>
              <div v-if="comment.tags.length" class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="tag in comment.tags"
                  :key="tag"
                  class="px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  profile: {
    likedArticles: {
      id: string
      slug: string
      title: string
      imageUrl: string | null
      publishedAt: string | null
      authorUsername: string
      views: number
      tags: string[]
      likesCount: number
    }[]
    comments: {
      id: string
      content: string
      articleSlug: string
      articleTitle: string
      authorUsername: string
      views: number
      tags: string[]
      createdAt: string
      likesCount: number
      dislikesCount: number
    }[]
  }
  pending: boolean
  error: any
  activeTab: 'likedArticles' | 'comments'
}>()

defineEmits<{
  (e: 'update:activeTab', value: 'likedArticles' | 'comments'): void
}>()

const tabs = [
  { id: 'likedArticles', label: 'Lajknuté články', icon: 'mdi:heart-outline' },
  { id: 'comments', label: 'Moje komentáře', icon: 'mdi:comment-outline' },
]
</script>
