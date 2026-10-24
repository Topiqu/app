<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" data-profile-metrics>
    <UButton
      v-for="item in interactiveStats"
      :key="item.label"
      color="neutral"
      variant="soft"
      :icon="item.icon"
      size="metric"
      class="w-full min-w-0"
      :ui="{ base: 'justify-start', leadingIcon: 'size-4 shrink-0' }"
      data-profile-metric
      :aria-label="`${item.label}: ${item.value}`"
      @click="item.action()"
    >
      <span class="flex min-w-0 items-baseline gap-1.5 text-left whitespace-normal">
        <span class="shrink-0 text-sm font-semibold tabular-nums text-highlighted">{{ item.value }}</span>
        <span class="text-xs leading-4 text-muted">{{ item.label }}</span>
      </span>
    </UButton>

    <UButton
      color="neutral"
      variant="soft"
      icon="mdi:thumb-up"
      size="metric"
      class="w-full min-w-0"
      :ui="{ base: 'justify-start', leadingIcon: 'size-4 shrink-0' }"
      data-profile-metric
      disabled
    >
      <span class="flex min-w-0 items-baseline gap-1.5 text-left whitespace-normal">
        <span class="shrink-0 text-sm font-semibold tabular-nums text-highlighted">{{ likesCount ?? 0 }}</span>
        <span class="text-xs leading-4 text-muted">{{ $t('profile.likes') }}</span>
      </span>
    </UButton>
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
    icon: 'mdi:account-multiple',
    label: $t('profile.following'),
    value: props.followers ?? 0,
    action: () => emit('open-dialog', 'followed'),
  },
  {
    icon: 'mdi:account-multiple',
    label: $t('profile.followers'),
    value: props.following ?? 0,
    action: () => emit('open-dialog', 'followers'),
  },
  {
    icon: 'mdi:heart',
    label: $t('profile.likedArticles'),
    value: props.likedArticles?.length ?? 0,
    action: () => emit('update-tab', 'likedArticles'),
  },
  {
    icon: 'mdi:comment-multiple-outline',
    label: $t('articles.comments.title'),
    value: props.commentsCount ?? 0,
    action: () => emit('update-tab', 'comments'),
  },
])
</script>
