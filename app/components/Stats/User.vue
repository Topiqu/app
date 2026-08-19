<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
    <component
      :is="metric.onSelect ? 'button' : 'div'"
      v-for="metric in metrics"
      :key="metric.label"
      :type="metric.onSelect ? 'button' : undefined"
      class="rounded-xl bg-neutral-50 px-3.5 py-3 text-left transition-colors dark:bg-neutral-800/40"
      :class="
        metric.onSelect &&
        'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
      "
      @click="metric.onSelect?.()"
    >
      <span class="flex items-center gap-1.5">
        <Icon :name="metric.icon" class="size-4 shrink-0" :class="metric.tone" />
        <span class="text-2xl font-semibold leading-none tabular-nums text-neutral-900 dark:text-neutral-100">
          {{ metric.value }}
        </span>
      </span>
      <!-- Label below the number, so a two-line label ("Oblíbené články") cannot push the
           figures out of alignment with each other. -->
      <span class="mt-1.5 block text-xs leading-tight text-neutral-500 dark:text-neutral-400">
        {{ metric.label }}
      </span>
    </component>
  </div>
</template>

<script setup lang="ts">
const {
  followingCount = 0,
  followerCount = 0,
  likedArticles,
  commentsCount = 0,
  likesCount = 0,
} = defineProps<{
  followingCount?: number
  followerCount?: number
  likedArticles?: Array<{ id: string }>
  commentsCount?: number
  likesCount?: number
}>()

const emit = defineEmits<{
  (e: 'openDialog', type: 'followers' | 'followed'): void
  (e: 'updateTab', tab: 'likedArticles' | 'comments'): void
}>()

const neutralTone = 'text-neutral-400 dark:text-neutral-500'

const metrics = computed(() => [
  {
    label: $t('profile.following'),
    value: followingCount,
    icon: 'mdi:account-arrow-right-outline',
    tone: neutralTone,
    onSelect: () => emit('openDialog', 'followed'),
  },
  {
    label: $t('profile.followers'),
    value: followerCount,
    icon: 'mdi:account-multiple-outline',
    tone: neutralTone,
    onSelect: () => emit('openDialog', 'followers'),
  },
  {
    label: $t('profile.likedArticles'),
    value: likedArticles?.length ?? 0,
    icon: 'mdi:heart',
    tone: 'text-red-500',
    onSelect: () => emit('updateTab', 'likedArticles'),
  },
  {
    label: $t('articles.comments.title'),
    value: commentsCount,
    icon: 'mdi:comment-multiple-outline',
    tone: neutralTone,
    onSelect: () => emit('updateTab', 'comments'),
  },
  {
    label: $t('profile.likes'),
    value: likesCount,
    icon: 'mdi:thumb-up',
    tone: 'text-green-600 dark:text-green-500',
    onSelect: undefined,
  },
])
</script>
