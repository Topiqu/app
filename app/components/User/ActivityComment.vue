<template>
  <article
    class="rounded-(--topiqu-surface-radius) p-4"
    :class="
      nested
        ? 'border-l-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 ml-6 sm:ml-10'
        : 'border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
    "
  >
    <header class="flex items-center gap-2">
      <UserPicture :name="comment.authorUsername" :url="comment.authorPfp" />
      <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ comment.authorUsername }}</span>
      <span class="text-xs text-neutral-400 dark:text-neutral-500">{{ formatDate(comment.createdAt) }}</span>
    </header>

    <p class="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 text-pretty">
      {{ comment.content }}
    </p>

    <NuxtLink
      :to="localePath({ name: 'clanky-slug', params: { slug: comment.articleSlug } }) + `#comment-${comment.id}`"
      class="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
    >
      <UIcon name="mdi:file-document-outline" class="size-3.5 shrink-0" />
      {{ comment.articleTitle }}
    </NuxtLink>

    <div class="mt-3 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
      <span class="flex items-center gap-1">
        <UIcon name="mdi:thumb-up-outline" class="size-3.5" />
        <span class="tabular-nums">{{ comment.likesCount }}</span>
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="mdi:thumb-down-outline" class="size-3.5" />
        <span class="tabular-nums">{{ comment.dislikesCount }}</span>
      </span>
      <UButton
        v-if="isOwn"
        icon="mdi:delete-outline"
        square
        size="sm"
        color="neutral"
        variant="ghost"
        class="!text-red-600 dark:!text-red-400"
        :aria-label="$t('common.actions.delete')"
        :title="$t('common.actions.delete')"
        @click="$emit('delete', comment.id)"
      />
    </div>

    <div v-if="comment.tags.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="tag in comment.tags"
        :key="tag"
        class="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
      >
        {{ tag }}
      </span>
    </div>

    <div class="mt-4 space-y-3 empty:mt-0">
      <slot name="replies" />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Comment as _Comment } from '@prisma/client'

import { formatDate } from '~~/shared/utils'

export type ActivityComment = Pick<_Comment, 'id' | 'content' | 'userId' | 'parentId'> & {
  articleSlug: string
  articleTitle: string
  authorUsername: string
  authorPfp?: string | null
  tags: string[]
  likesCount: number
  dislikesCount: number
  replies?: ActivityComment[]
  createdAt: string
  deletedAt?: string | null
}

const { comment } = defineProps<{
  comment: ActivityComment
  nested?: boolean
}>()

defineEmits<(e: 'delete', id: string) => void>()

const localePath = useLocalePath()
const { data: session } = useAuth()

const isOwn = computed(() => session.value?.user?.id === comment.userId)
</script>
