<template>
  <div class="mt-10">
    <div class="flex border-b border-gray-200 dark:border-neutral-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-4 py-2 text-sm font-medium"
        :class="[
          activeTab === tab.id
            ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400',
        ]"
        @click="$emit('update:activeTab', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="mt-6">
      <div v-if="activeTab === 'likedArticles'" class="space-y-4">
        <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">Načítání...</div>
        <div v-else-if="error" class="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <p class="text-red-600 dark:text-red-400">{{ error?.message || 'Chyba při načítání' }}</p>
        </div>
        <div v-else-if="!profile.likedArticles?.length" class="text-center text-gray-500 dark:text-gray-400 py-8">
          Žádné lajknuté články.
        </div>
        <div v-else class="grid gap-4">
          <div
            v-for="article in profile.likedArticles"
            :key="article.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-neutral-900"
          >
            <NuxtImg
              v-if="article.imageUrl"
              :src="article.imageUrl"
              :alt="`Obrázek článku ${article.title}`"
              format="webp"
              quality="80"
              width="40"
              height="40"
              class="w-10 h-10 rounded-full object-cover"
            />
            <Icon v-else name="mdi:image-outline" class="w-10 h-10 text-gray-400 dark:text-gray-600" />
            <div>
              <NuxtLink
                :to="`/clanky/${article.slug}`"
                class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {{ article.title }}
              </NuxtLink>
              <p v-if="article.publishedAt" class="text-sm text-gray-600 dark:text-gray-400">
                Publikováno: {{ formatDate(article.publishedAt) }}
              </p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Lajky: {{ article.likesCount }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-if="activeTab === 'comments'" class="space-y-4">
        <div v-if="pending" class="text-center text-gray-500 dark:text-gray-400 py-8">Načítání...</div>
        <div v-else-if="error" class="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
          <p class="text-red-600 dark:text-red-400">{{ error?.message || 'Chyba při načítání' }}</p>
        </div>
        <div v-else-if="!profile.comments?.length" class="text-center text-gray-500 dark:text-gray-400 py-8">
          Žádné komentáře.
        </div>
        <div v-else class="grid gap-4">
          <div
            v-for="comment in profile.comments"
            :key="comment.id"
            class="p-3 rounded-lg bg-gray-50 dark:bg-neutral-900"
          >
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ comment.content }}</p>
            <NuxtLink
              :to="`/clanky/${comment.articleSlug}#comment-${comment.id}`"
              class="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm"
            >
              Článek: {{ comment.articleTitle }}
            </NuxtLink>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Vytvořeno: {{ formatDate(comment.createdAt) }}</p>
            <div class="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
              <p>Lajky: {{ comment.likesCount }}</p>
              <p>Disliky: {{ comment.dislikesCount }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  profile: {
    likedArticles: Array<{
      id: string
      slug: string
      title: string
      imageUrl: string | null
      publishedAt: string | null
      likesCount: number
    }>
    comments: Array<{
      id: string
      content: string
      articleSlug: string
      articleTitle: string
      createdAt: string
      likesCount: number
      dislikesCount: number
    }>
  }
  pending: boolean
  error: any
  activeTab: 'likedArticles' | 'comments'
}>()

defineEmits<{
  (e: 'update:activeTab', value: 'likedArticles' | 'comments'): void
}>()

const tabs = [
  { id: 'likedArticles', label: 'Lajknuté články' },
  { id: 'comments', label: 'Moje komentáře' },
]
</script>
