<template>
  <div class="mb-6 grid grid-cols-2 gap-2 sm:mb-8 sm:grid-cols-3 lg:grid-cols-5" data-profile-metrics>
    <UButton
      v-for="item in interactiveStats"
      :key="item.label"
      color="neutral"
      variant="soft"
      :icon="item.icon"
      :label="`${item.label}: ${item.value}`"
      size="xs"
      class="w-full"
      :ui="{ base: 'h-full min-h-14 justify-center px-2', label: 'text-[11px] whitespace-nowrap' }"
      data-profile-metric
      :aria-label="`${item.label}: ${item.value}`"
      @click="item.action()"
    />

    <UButton
      color="neutral"
      variant="soft"
      icon="i-mdi-thumb-up"
      :label="`${$t('profile.likes')}: ${likesCount ?? 0}`"
      size="xs"
      class="w-full"
      :ui="{ base: 'h-full min-h-14 justify-center px-2', label: 'text-[11px] whitespace-nowrap' }"
      data-profile-metric
      disabled
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  followers?: number
  following?: number
  likedArticles?: Array<{ id: string }>
  commentsCount?: number
  likesCount?: number
}>()

const emit = defineEmits<{
  (e: 'open-dialog', type: 'followers' | 'followed'): void
  (e: 'update-tab', tab: 'likedArticles' | 'comments'): void
}>()

const interactiveStats = computed(() => [
  {
    icon: 'i-mdi-account-multiple',
    label: $t('profile.following'),
    value: props.followers ?? 0,
    action: () => emit('open-dialog', 'followed'),
  },
  {
    icon: 'i-mdi-account-multiple',
    label: $t('profile.followers'),
    value: props.following ?? 0,
    action: () => emit('open-dialog', 'followers'),
  },
  {
    icon: 'i-mdi-heart',
    label: $t('profile.likedArticles'),
    value: props.likedArticles?.length ?? 0,
    action: () => emit('update-tab', 'likedArticles'),
  },
  {
    icon: 'i-mdi-comment-multiple-outline',
    label: $t('articles.comments.title'),
    value: props.commentsCount ?? 0,
    action: () => emit('update-tab', 'comments'),
  },
])
</script>
