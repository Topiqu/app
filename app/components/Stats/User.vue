<!-- components/UserStats.vue -->
<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
    <div
      class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
      @click="$emit('open-dialog', 'followed')"
    >
      <Icon name="mdi:account-multiple" class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
      <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {{ $t('profile.following') }}
      </p>
      <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
        {{ followers ?? 0 }}
      </p>
    </div>
    <div
      class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
      @click="$emit('open-dialog', 'followers')"
    >
      <Icon name="mdi:account-multiple" class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-indigo-500 dark:text-indigo-400" />
      <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {{ $t('profile.followers') }}
      </p>
      <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
        {{ following ?? 0 }}
      </p>
    </div>
    <div
      class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
      @click="$emit('update-tab', 'likedArticles')"
    >
      <Icon name="mdi:heart" class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-red-500 dark:text-red-400" />
      <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {{ $t('profile.likedArticles') }}
      </p>
      <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
        {{ likedArticles?.length ?? 0 }}
      </p>
    </div>
    <div
      class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 cursor-pointer touch-manipulation"
      @click="$emit('update-tab', 'comments')"
    >
      <Icon
        name="mdi:comment-multiple-outline"
        class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-indigo-500 dark:text-indigo-400"
      />
      <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {{ $t('articles.comments.title') }}
      </p>
      <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
        {{ commentsCount ?? 0 }}
      </p>
    </div>
    <div
      class="bg-gray-50 dark:bg-neutral-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 text-center transition-transform hover:scale-105 touch-manipulation"
    >
      <Icon name="mdi:thumb-up" class="w-5 h-5 sm:w-6 sm:h-6 mx-auto text-green-500 dark:text-green-400" />
      <p class="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">{{ $t('profile.likes') }}</p>
      <p class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
        {{ likesCount ?? 0 }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  followers?: number
  following?: number
  likedArticles?: Array<{ id: string }>
  commentsCount?: number
  likesCount?: number
}>()

defineEmits<{
  (e: 'open-dialog', type: 'followers' | 'followed'): void
  (e: 'update-tab', tab: 'likedArticles' | 'comments'): void
}>()
</script>
