<template>
  <div class="flex flex-col gap-4">
    <div v-if="series" class="flex items-center gap-3">
      <span
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 uppercase"
      >
        <Icon name="mdi:bookshelf" class="w-3.5 h-3.5" />
        {{ $t('series.label', 'Série') }}
      </span>
      <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
        <span class="font-bold text-gray-900 dark:text-white">{{ series.name }}</span>
        <span class="mx-2">•</span>
        {{ $t('series.part', 'Část') }} {{ series.current }} / {{ series.total }}
      </span>
    </div>

    <h1
      class="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent leading-tight mb-3"
    >
      {{ title }}
    </h1>

    <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
      <UserPicture :url="author.avatarUrl" :size="'md'" :name="author.username" />
      <div class="flex flex-col">
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="localePath({ name: 'autor-name', params: { name: author.username } })"
            class="font-medium text-[17px] text-blue-600 hover:text-blue-800"
          >
            {{ author.username }}
          </NuxtLink>
          <span class="italic text-gray-400 text-sm">• {{ $t('articles.articleCard.author') }}</span>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
          >
            <Icon name="mdi:account-group" class="w-3.5 h-3.5" />{{ followerCount }}
            {{ $t('profile.followers') }}
          </span>
          <button
            v-if="showFollowButton"
            class="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium text-gray-700 bg-white border-gray-200 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
            @click="$emit('follow')"
          >
            <Icon
              :name="isFollowing ? 'mdi:account-check' : 'mdi:account-plus'"
              class="w-3.5 h-3.5"
              :class="isFollowing ? 'text-green-500' : 'text-gray-500'"
            />
            {{ isFollowing ? $t('profile.unfollow') : $t('profile.follow') }}
          </button>
        </div>
      </div>
    </div>

    <p
      v-if="excerpt"
      class="text-lg md:text-xl italic text-gray-700 dark:text-gray-200 leading-relaxed border border-gray-200 dark:border-gray-700 rounded-xl px-6 py-4 mb-3"
    >
      {{ excerpt }}
    </p>

    <NuxtImg
      v-if="imageUrl"
      :src="imageUrl"
      :alt="$t('articles.articleCard.imageAlt')"
      format="webp"
      quality="85"
      class="w-full max-h-[70vh] rounded-2xl object-contain bg-neutral-100 dark:bg-neutral-900 border border-gray-100/20"
      loading="lazy"
      placeholder
    />
  </div>
</template>

<script setup lang="ts">
const localePath = useLocalePath()

defineProps<{
  title: string
  author: { username: string; avatarUrl?: string | null }
  followerCount: number
  isFollowing: boolean
  showFollowButton: boolean
  excerpt?: string | null
  imageUrl?: string | null
  series?: { name: string; current: number; total: number } | null
}>()

defineEmits<{
  (e: 'follow'): void
}>()
</script>
