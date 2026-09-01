<template>
  <div class="group/author relative inline-flex min-w-0 max-w-full" @pointerenter="loadSummary" @focusin="loadSummary">
    <UButton
      :to="authorPath"
      color="neutral"
      variant="ghost"
      :ui="{
        base:
          size === 'large'
            ? 'min-w-0 max-w-full !h-auto justify-start rounded-full p-1.5 pr-4'
            : 'min-w-0 max-w-full !h-auto justify-start rounded-full p-1 pr-3',
      }"
    >
      <span class="flex min-w-0 items-center gap-2.5">
        <UserPicture :url="user.avatarUrl" :name="user.username" :size="size === 'large' ? 'lg' : undefined" />
        <span class="min-w-0 text-left">
          <span
            :class="size === 'large' ? 'text-base' : 'text-sm'"
            class="block truncate font-medium text-highlighted"
            >{{ user.username }}</span
          >
          <span v-if="roleLabel" class="block truncate text-xs font-normal text-muted">{{ roleLabel }}</span>
        </span>
      </span>
    </UButton>
    <div
      class="pointer-events-none invisible absolute bottom-full left-0 z-popover mb-2 block w-[min(20rem,calc(100vw-2rem))] translate-y-1 rounded-[var(--topiqu-surface-radius)] border border-default bg-default p-4 text-left opacity-0 shadow-xl transition motion-reduce:transition-none group-hover/author:pointer-events-auto group-hover/author:visible group-hover/author:translate-y-0 group-hover/author:opacity-100 group-focus-within/author:pointer-events-auto group-focus-within/author:visible group-focus-within/author:translate-y-0 group-focus-within/author:opacity-100"
    >
      <div class="flex items-center gap-3">
        <UserPicture :url="summary?.avatarUrl || user.avatarUrl" :name="user.username" size="lg" />
        <div class="min-w-0 flex-1">
          <NuxtLink :to="authorPath" class="block truncate font-semibold text-highlighted hover:text-primary">{{
            user.username
          }}</NuxtLink>
          <p v-if="summary" class="text-xs text-muted">{{ summary.roleLabel }}</p>
        </div>
      </div>
      <p class="mt-3 line-clamp-3 text-sm leading-6 text-muted">
        {{ summary?.bio || user.bio || $t('articles.userMenu.noBio') }}
      </p>
      <div v-if="pending" class="mt-4 grid grid-cols-3 gap-2" aria-busy="true">
        <USkeleton v-for="i in 3" :key="i" class="h-10" />
      </div>
      <p v-else-if="loadFailed" class="mt-4 text-xs text-muted">
        {{ $t('common.messages.loadFailedText') }}
      </p>
      <template v-else-if="summary">
        <dl
          class="mt-4 grid grid-cols-3 divide-x divide-default rounded-[var(--ui-radius)] bg-elevated p-2 text-center"
        >
          <div>
            <dt class="text-xs text-muted">{{ $t('stats.articleCount') }}</dt>
            <dd class="font-semibold">{{ summary.articleCount }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ $t('profile.followers') }}</dt>
            <dd class="font-semibold">{{ summary.followerCount }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">{{ $t('articles.comments.title') }}</dt>
            <dd class="font-semibold">{{ summary.commentCount }}</dd>
          </div>
        </dl>
        <p v-if="summary.joinedAt" class="mt-3 text-xs text-muted">
          {{ $t('common.user.joined', [formatArticleDate(summary.joinedAt, locale)]) }}
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicAuthorSummary } from '~~/shared/types/article'

import { formatArticleDate } from '~~/shared/utils/time'

const {
  user,
  size = 'default',
  roleLabel,
} = defineProps<{
  user: {
    id: string
    username: string
    avatarUrl?: string | null
    bio?: string | null
  }
  size?: 'default' | 'large'
  roleLabel?: string
}>()
const localePath = useLocalePath()
const { locale } = useI18n()
const authorPath = computed(() => localePath({ name: 'autor-name', params: { name: user.username } }))
const summary = shallowRef<PublicAuthorSummary | null>(null)
const pending = shallowRef(false)
const loadFailed = shallowRef(false)

const loadSummary = async () => {
  if (summary.value || pending.value) return
  pending.value = true
  loadFailed.value = false
  try {
    summary.value = await $fetch<PublicAuthorSummary>(`/api/users/${user.id}/author`, {
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    loadFailed.value = true
  } finally {
    pending.value = false
  }
}
</script>
