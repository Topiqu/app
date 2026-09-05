<template>
  <article
    :id="`comment-${comment.id}`"
    class="relative w-full min-w-0 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 sm:p-5"
  >
    <div class="absolute right-3 top-3 z-10 flex gap-1">
      <UButton
        v-if="perms.report"
        square
        variant="ghost"
        size="sm"
        icon="mdi:flag-outline"
        color="warning"
        :aria-label="$t('articles.comments.reportComment')"
        :title="$t('articles.comments.reportComment')"
        @click="report"
      />
      <UButton
        v-if="perms.ban"
        square
        variant="ghost"
        size="sm"
        icon="mdi:account-cancel"
        color="warning"
        :aria-label="$t('articles.comments.banUser')"
        :title="$t('articles.comments.banUser')"
        @click="showBanModal = true"
      />
    </div>

    <header class="flex min-w-0 items-start gap-3 sm:pr-64">
      <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base flex-wrap">
        <UserCard v-if="userCardProps" :user="userCardProps" />
        <UBadge v-else-if="perms.isBanned" color="error" variant="soft">
          {{ $t('articles.comments.bannedUser') }}
          <span v-if="comment.user?.banDetails?.reason && perms.isAdmin">
            ({{ $t('articles.comments.banReason', [comment.user.banDetails.reason]) }})
          </span>
          <span v-if="comment.user?.banDetails?.expiresAt && perms.isAdmin">
            {{ $t('articles.comments.banExpires', [new Date(comment.user.banDetails.expiresAt).toLocaleString()]) }}
          </span>
        </UBadge>
        <span v-else class="font-semibold text-highlighted">{{ $t('common.user.notAvailable') }}</span>
      </div>
    </header>

    <div
      v-if="!comment.deletedAt"
      class="mt-3 flex shrink-0 flex-wrap justify-end gap-1 sm:absolute sm:right-5 sm:top-5 sm:mt-0"
    >
      <UButton
        v-if="perms.reply"
        size="sm"
        color="neutral"
        variant="soft"
        icon="mdi:reply"
        :aria-label="$t('articles.comments.submitReply')"
        @click="emit('reply', comment)"
      >
        <span class="hidden sm:inline">{{ $t('articles.comments.reply') }}</span>
      </UButton>
      <UButton
        v-if="perms.deleteOwn"
        size="sm"
        color="error"
        variant="soft"
        icon="mdi:delete"
        :aria-label="$t('articles.comments.deleteComment')"
        @click="emit('delete', comment, null)"
      >
        <span class="hidden sm:inline">{{ $t('articles.comments.deleteComment') }}</span>
      </UButton>
      <UButton
        v-else-if="perms.moderateDelete"
        size="sm"
        color="error"
        variant="soft"
        icon="mdi:delete"
        :aria-label="$t('articles.comments.deleteCommentAdmin')"
        @click="showDeleteModal = true"
      >
        <span class="hidden sm:inline">{{ $t('articles.comments.deleteCommentAdmin') }}</span>
      </UButton>
      <UButton
        v-if="perms.unban"
        size="sm"
        color="success"
        variant="soft"
        icon="mdi:account-check"
        :aria-label="$t('articles.comments.unbanUser')"
        @click="unbanUser"
      >
        <span class="hidden sm:inline">{{ $t('articles.comments.unbanUser') }}</span>
      </UButton>
    </div>

    <div class="mt-2 text-xs text-muted sm:text-sm">{{ formatDate(comment.createdAt, locale) }}</div>

    <p
      class="mt-2 sm:mt-3 whitespace-pre-line text-xs sm:text-sm md:text-base break-words"
      :class="{ 'text-muted italic': comment.deletedAt || perms.isBanned }"
    >
      {{ displayContent }}
    </p>

    <Gif v-if="comment.gifUrl && !comment.deletedAt && !perms.isBanned" :content="comment.gifUrl" />

    <div
      v-if="!comment.deletedAt && !perms.isBanned"
      class="mt-4 flex flex-wrap items-center justify-between gap-2 sm:mt-5 sm:gap-3"
    >
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <UButton
          size="sm"
          :color="state.userReaction?.type === 'LIKE' ? 'success' : 'neutral'"
          :variant="state.userReaction?.type === 'LIKE' ? 'solid' : 'soft'"
          :icon="state.userReaction?.type === 'LIKE' ? 'mdi:thumb-up' : 'mdi:thumb-up-outline'"
          :aria-pressed="state.userReaction?.type === 'LIKE'"
          @click="updateReaction('LIKE')"
        >
          <span>{{ state.likes }}</span>
        </UButton>
        <UButton
          size="sm"
          :color="state.userReaction?.type === 'DISLIKE' ? 'error' : 'neutral'"
          :variant="state.userReaction?.type === 'DISLIKE' ? 'solid' : 'soft'"
          :icon="state.userReaction?.type === 'DISLIKE' ? 'mdi:thumb-down' : 'mdi:thumb-down-outline'"
          :aria-pressed="state.userReaction?.type === 'DISLIKE'"
          @click="updateReaction('DISLIKE')"
        >
          <span>{{ state.dislikes }}</span>
        </UButton>

        <EmojiReactionChip
          v-for="r in state.emojiReactions"
          :key="r.emojiId"
          :imageUrl="r.emoji.imageUrl"
          :shortcode="r.emoji.shortcode"
          :count="r.count"
        />
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <LazyEmojiPopover :commentId="comment.id" :articleId="comment.articleId" @reaction="handleEmojiReaction" />
        <UTooltip
          v-if="state.isLikedByAuthor"
          :text="$t('articles.comments.likedByAuthor', [authorData?.username || $t('common.user.notAvailable')])"
        >
          <div class="flex items-center gap-1">
            <UIcon size="20" name="mdi:heart" class="text-error" />
            <UserPicture :url="authorData?.avatarUrl" size="mn" :name="authorData?.username" />
          </div>
        </UTooltip>
      </div>
    </div>

    <div v-if="comment.replies?.length" class="mt-4 sm:mt-6 space-y-4">
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :isReplying
        :depth="Math.min(depth + 1, 12)"
        @reply="emit('reply', $event)"
        @delete="(c, r) => emit('delete', c, r)"
        @like="emit('like', $event)"
        @dislike="emit('dislike', $event)"
        @refresh="emit('refresh')"
      />
    </div>

    <UModal
      v-if="showDeleteModal"
      v-model:open="showDeleteModal"
      :title="$t('articles.comments.deleteModalTitle')"
      :description="$t('common.messages.deleteConfirmText')"
    >
      <template #body>
        <UFormField :label="$t('articles.comments.deleteReasonPlaceholder')">
          <UTextarea
            v-model="deleteReason"
            :placeholder="$t('articles.comments.deleteReasonPlaceholder')"
            :maxLength="255"
            autoresize
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showDeleteModal = false">{{
            $t('common.messages.deleteCancel')
          }}</UButton>
          <UButton color="error" @click="confirmDelete">{{ $t('articles.comments.deleteComment') }}</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-if="showBanModal"
      v-model:open="showBanModal"
      :title="$t('articles.comments.banModalTitle')"
      :description="$t('articles.comments.banReasonPrompt')"
    >
      <template #body>
        <UFormField :label="$t('articles.comments.banReasonPlaceholder')">
          <UTextarea
            v-model="banReason"
            required
            :placeholder="$t('articles.comments.banReasonPlaceholder')"
            :maxLength="255"
            autoresize
          />
        </UFormField>
        <UFormField class="mt-4" :label="$t('articles.comments.banExpirationLabel')">
          <UInput
            :modelValue="banExpiresAt ?? undefined"
            type="datetime-local"
            @update:modelValue="banExpiresAt = $event || null"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showBanModal = false">{{
            $t('common.messages.deleteCancel')
          }}</UButton>
          <UButton color="error" :disabled="!banReason.trim()" @click="banUser">{{
            $t('articles.comments.banUser')
          }}</UButton>
        </div>
      </template>
    </UModal>
  </article>
</template>

<script setup lang="ts">
import type { CommentWithReplies } from '~~/types/comment'

import { formatDate } from '~~/shared/utils'

const props = defineProps<{
  comment: CommentWithReplies
  isReplying: boolean
  depth: number
}>()
const emit = defineEmits<{
  (e: 'reply' | 'like' | 'dislike', c: CommentWithReplies): void
  (e: 'delete', c: CommentWithReplies, reason: string | null): void
  (e: 'refresh'): void
}>()

const toast = useToast()
const confirm = useConfirm()
const { locale } = useI18n()

const showDeleteModal = shallowRef(false)
const showBanModal = shallowRef(false)
const deleteReason = shallowRef('')
const banReason = shallowRef('')
const banExpiresAt = shallowRef<string | null>(null)

const { data: authorData } = await useFetch(`/api/users/${props.comment.article.userId}/author`, {
  key: `author-${props.comment.article.userId}`,
})

const commentRef = computed(() => props.comment)
const isReplyingRef = computed(() => props.isReplying)
const perms = useCommentPermissions(commentRef, isReplyingRef)

const displayContent = computed(() =>
  props.comment.deletedAt
    ? $t('articles.comments.deletedComment')
    : perms.isBanned
      ? $t('articles.comments.bannedUserComment')
      : props.comment.content,
)

const userCardProps = computed(() => {
  const u = props.comment.user
  if (!u || u.isBanned) return null
  return {
    id: props.comment.userId,
    username: u.username,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
  }
})

const { state, updateReaction, handleEmojiReaction } = useCommentReactions(commentRef, {
  isAuthor: toRef(perms, 'isAuthor'),
  currentUserId: computed(() => perms.user?.id),
})

const report = async () => {
  if (
    !(await confirm({
      title: $t('articles.comments.reportCommentConfirm'),
      confirmText: $t('common.actions.confirm'),
      cancelText: $t('common.messages.cancel'),
    }))
  )
    return
  try {
    await $fetch('/api/notifications', {
      method: 'POST',
      body: { commentId: props.comment.id },
    })
    toast.add({ color: 'success', title: $t('common.messages.reportSuccess') })
  } catch {
    toast.add({ color: 'error', title: $t('common.messages.reportFailed') })
  }
}

const confirmDelete = () => {
  emit('delete', props.comment, deleteReason.value)
  showDeleteModal.value = false
  deleteReason.value = ''
}

const banUser = async () => {
  if (!banReason.value.trim()) return
  try {
    await $fetch(`/api/bans/${props.comment.id}`, {
      method: 'POST',
      body: {
        reason: banReason.value,
        expiresAt: banExpiresAt.value ? new Date(banExpiresAt.value).toISOString() : null,
      },
    })
    toast.add({ color: 'success', title: $t('articles.comments.banSuccess') })
    showBanModal.value = false
    banReason.value = ''
    banExpiresAt.value = null
  } catch (e: any) {
    toast.add({
      color: 'error',
      title: e.data?.message || $t('articles.comments.banFailed'),
    })
  }
}

const unbanUser = async () => {
  try {
    await $fetch(`/api/bans/${props.comment.id}`, { method: 'DELETE' })
    toast.add({
      color: 'success',
      title: $t('articles.comments.unbanSuccess'),
    })
    emit('refresh')
  } catch (e: any) {
    toast.add({
      color: 'error',
      title: e.data?.message || $t('articles.comments.unbanFailed'),
    })
  }
}
</script>
