<template>
  <div
    :id="`comment-${comment.id}`"
    class="relative w-full min-w-fit bg-white pt-2 pb-0.5 pl-2 pr-0.5 sm:pt-4 sm:pb-1 sm:pl-4 sm:pr-1 md:pt-6 md:pb-1.5 md:pl-6 md:pr-1.5 rounded-3xl shadow border border-gray-200"
  >
    <div class="absolute top-2 right-2 sm:top-3 sm:right-3 flex gap-2 z-10">
      <Button
        v-if="perms.report"
        square
        borderless
        size="sm"
        variant="transparent"
        icon="mdi:flag-outline"
        class="!bg-transparent text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400"
        :aria="$t('articles.comments.reportComment')"
        :title="$t('articles.comments.reportComment')"
        @click="report"
      />
      <Button
        v-if="perms.ban"
        square
        borderless
        size="sm"
        variant="transparent"
        icon="mdi:account-cancel"
        class="!bg-transparent text-orange-500 hover:text-orange-600"
        :aria="$t('articles.comments.banUser')"
        :title="$t('articles.comments.banUser')"
        @click="showBanModal = true"
      />
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pr-2 sm:pr-4 md:pr-6">
      <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base flex-wrap">
        <UserCard v-if="userCardProps" :user="userCardProps" />
        <span v-else-if="perms.isBanned" class="font-semibold text-red-500">
          {{ $t('articles.comments.bannedUser') }}
          <span v-if="comment.user?.banDetails?.reason && perms.isAdmin">
            ({{ $t('articles.comments.banReason', [comment.user.banDetails.reason]) }})
          </span>
          <span v-if="comment.user?.banDetails?.expiresAt && perms.isAdmin">
            {{ $t('articles.comments.banExpires', [new Date(comment.user.banDetails.expiresAt).toLocaleString()]) }}
          </span>
        </span>
        <span v-else class="font-semibold text-gray-800">{{ $t('common.user.notAvailable') }}</span>
      </div>

      <div v-if="!comment.deletedAt" class="flex flex-col gap-1 sm:gap-2">
        <Button
          v-if="perms.reply"
          size="sm"
          variant="neutral"
          icon="mdi:reply"
          :aria="$t('articles.comments.submitReply')"
          @click="emit('reply', comment)"
        >
          <span class="hidden sm:inline">{{ $t('articles.comments.reply') }}</span>
        </Button>
        <Button
          v-if="perms.deleteOwn"
          size="sm"
          variant="neutral"
          icon="mdi:delete"
          class="[&_.iconify]:text-red-500"
          :aria="$t('articles.comments.deleteComment')"
          @click="emit('delete', comment, null)"
        >
          <span class="hidden sm:inline">{{ $t('articles.comments.deleteComment') }}</span>
        </Button>
        <Button
          v-else-if="perms.moderateDelete"
          size="sm"
          variant="neutral"
          icon="mdi:delete"
          class="[&_.iconify]:text-red-500"
          :aria="$t('articles.comments.deleteCommentAdmin')"
          @click="showDeleteModal = true"
        >
          <span class="hidden sm:inline">{{ $t('articles.comments.deleteCommentAdmin') }}</span>
        </Button>
        <Button
          v-if="perms.unban"
          size="sm"
          variant="neutral"
          icon="mdi:account-check"
          class="[&_.iconify]:text-green-500"
          :aria="$t('articles.comments.unbanUser')"
          @click="unbanUser"
        >
          <span class="hidden sm:inline">{{ $t('articles.comments.unbanUser') }}</span>
        </Button>
      </div>
    </div>

    <div class="text-xs sm:text-sm text-gray-500 mt-2">{{ formatDate(comment.createdAt) }}</div>

    <p
      class="mt-2 sm:mt-3 whitespace-pre-line text-xs sm:text-sm md:text-base break-words"
      :class="{ 'text-gray-400 italic': comment.deletedAt || perms.isBanned }"
    >
      {{ displayContent }}
    </p>

    <Gif v-if="comment.gifUrl && !comment.deletedAt && !perms.isBanned" :content="comment.gifUrl" class="mt-2" />

    <div
      v-if="!comment.deletedAt && !perms.isBanned"
      class="mt-4 sm:mt-5 flex items-center justify-between flex-wrap gap-2 sm:gap-3 pb-2 sm:pb-4 md:pb-6"
    >
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Button
          size="sm"
          variant="neutral"
          icon="mdi:thumb-up-outline"
          :class="state.userReaction?.type === 'LIKE' ? '!bg-green-100 !text-green-600' : 'text-gray-600'"
          @click="updateReaction('LIKE')"
        >
          <span>{{ state.likes }}</span>
        </Button>
        <Button
          size="sm"
          variant="neutral"
          icon="mdi:thumb-down-outline"
          :class="state.userReaction?.type === 'DISLIKE' ? '!bg-red-100 !text-red-600' : 'text-gray-600'"
          @click="updateReaction('DISLIKE')"
        >
          <span>{{ state.dislikes }}</span>
        </Button>

        <div
          v-for="r in state.emojiReactions"
          :key="r.emojiId"
          v-tippy="{ content: r.emoji.shortcode, placement: 'top' }"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 bg-gray-100 text-gray-600"
        >
          <img :src="r.emoji.imageUrl" :alt="r.emoji.shortcode" class="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{{ r.count }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <LazyEmojiPopover :commentId="comment.id" :articleId="comment.articleId!" @reaction="handleEmojiReaction" />
        <div
          v-if="state.isLikedByAuthor"
          v-tippy="{
            content: $t('articles.comments.likedByAuthor', [authorData?.username || $t('common.user.notAvailable')]),
            placement: 'top',
          }"
          class="flex items-center gap-1"
        >
          <Icon name="mdi:heart" class="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          <UserPicture :url="authorData?.avatarUrl" size="mn" :name="authorData?.username" />
        </div>
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

    <ModalMini
      v-if="showDeleteModal"
      v-model:open="showDeleteModal"
      :title="$t('articles.comments.deleteModalTitle')"
      :message="$t('common.messages.deleteConfirmText')"
      icon="mdi:delete"
      :cancelText="$t('common.messages.deleteCancel')"
      :confirmText="$t('articles.comments.deleteComment')"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    >
      <template #content>
        <FormInput
          v-model="deleteReason"
          type="textarea"
          :placeholder="$t('articles.comments.deleteReasonPlaceholder')"
          :maxLength="255"
        />
      </template>
    </ModalMini>

    <ModalMini
      v-if="showBanModal"
      v-model:open="showBanModal"
      :title="$t('articles.comments.banModalTitle')"
      :message="$t('articles.comments.banReasonPrompt')"
      icon="mdi:account-cancel"
      :cancelText="$t('common.messages.deleteCancel')"
      :confirmText="$t('articles.comments.banUser')"
      @confirm="banUser"
      @cancel="showBanModal = false"
    >
      <template #content>
        <FormInput
          v-model="banReason"
          type="textarea"
          required
          :placeholder="$t('articles.comments.banReasonPlaceholder')"
          :maxLength="255"
        />
        <FormField
          v-model="banExpiresAt"
          type="datetime-local"
          class="mt-4"
          :label="$t('articles.comments.banExpirationLabel')"
        />
      </template>
    </ModalMini>
  </div>
</template>

<script setup lang="ts">
import type { CommentWithReplies } from '~~/types/comment'

import { formatDate } from '~~/shared/utils'
import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'

const props = defineProps<{ comment: CommentWithReplies; isReplying: boolean; depth: number }>()
const emit = defineEmits<{
  (e: 'reply' | 'like' | 'dislike', c: CommentWithReplies): void
  (e: 'delete', c: CommentWithReplies, reason: string | null): void
  (e: 'refresh'): void
}>()

const toast = useToast()

const showDeleteModal = shallowRef(false)
const showBanModal = shallowRef(false)
const deleteReason = shallowRef('')
const banReason = shallowRef('')
const banExpiresAt = shallowRef<Date | undefined>(undefined)

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
    email: u.email!,
    createdAt: u.createdAt,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    lastLogin: u.lastLogin,
    commentsCount: u.commentsCount,
    likesCount: u.likesCount,
    dislikesCount: u.dislikesCount,
    followers: u.followers,
    following: u.following,
    role: u.role,
  }
})

const { state, updateReaction, handleEmojiReaction } = useCommentReactions(commentRef, {
  isAuthor: toRef(perms, 'isAuthor'),
  currentUserId: computed(() => perms.user?.id),
})

const report = async () => {
  if (!confirm($t('articles.comments.reportCommentConfirm'))) return
  try {
    await $fetch('/api/notifications', { method: 'POST', body: { commentId: props.comment.id } })
    toast.success({ message: $t('common.messages.reportSuccess') })
  } catch {
    toast.error({ message: $t('common.messages.reportFailed') })
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
      body: { reason: banReason.value, expiresAt: banExpiresAt.value?.toISOString() ?? null },
    })
    toast.success({ message: $t('articles.comments.banSuccess') })
    showBanModal.value = false
    banReason.value = ''
    banExpiresAt.value = undefined
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.comments.banFailed') })
  }
}

const unbanUser = async () => {
  try {
    await $fetch(`/api/bans/${props.comment.id}`, { method: 'DELETE' })
    toast.success({ message: $t('articles.comments.unbanSuccess') })
    emit('refresh')
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('articles.comments.unbanFailed') })
  }
}
</script>
