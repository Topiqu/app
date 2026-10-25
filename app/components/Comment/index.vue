<template>
  <article
    :id="`comment-${comment.id}`"
    tabindex="-1"
    class="relative w-full min-w-0 scroll-mt-24 rounded-(--topiqu-surface-radius) border border-default bg-default p-4 sm:p-5"
  >
    <div v-if="comment.contextParentId" class="mb-4">
      <UButton
        color="neutral"
        variant="soft"
        class="max-w-full whitespace-normal text-left"
        :loading="pendingContexts.has(comment.id)"
        :disabled="pendingContexts.has(comment.id)"
        @click="emit('loadContext', comment)"
        >{{ $t('articles.comments.loadEarlierContext') }}</UButton
      >
    </div>
    <header class="flex min-w-0 flex-wrap items-start gap-2 sm:gap-3">
      <div class="flex min-w-0 flex-1 basis-32 items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base flex-wrap">
        <UserCard v-if="userCardProps" :user="userCardProps" />
        <UBadge
          v-else-if="perms.isBanned"
          color="error"
          variant="soft"
          class="max-w-full whitespace-normal break-words"
        >
          {{ $t('articles.comments.bannedUser') }}
          <span v-if="comment.user?.banDetails?.reason">
            ({{ $t('articles.comments.banReason', [comment.user.banDetails.reason]) }})
          </span>
          <span v-if="comment.user?.banDetails?.expiresAt">
            {{ $t('articles.comments.banExpires', [new Date(comment.user.banDetails.expiresAt).toLocaleString()]) }}
          </span>
        </UBadge>
        <span v-else class="font-semibold text-highlighted">{{ $t('common.user.notAvailable') }}</span>
      </div>
      <div class="ml-auto flex shrink-0 items-center justify-end gap-1">
        <UButton
          v-if="!comment.deletedAt && perms.reply && allowReplies !== false"
          size="sm"
          color="neutral"
          variant="soft"
          icon="mdi:reply"
          :aria-label="$t('articles.comments.submitReply')"
          @click="emit('reply', comment)"
        >
          <span class="hidden sm:inline">{{ $t('articles.comments.reply') }}</span>
        </UButton>
        <UDropdownMenu v-if="commentActions.length" :items="commentActions" :content="{ align: 'end' }">
          <UButton
            square
            size="sm"
            color="neutral"
            variant="ghost"
            icon="mdi:dots-horizontal"
            :aria-label="$t('common.actions.more')"
            :disabled="moderationPending || reportPending"
          />
        </UDropdownMenu>
      </div>
    </header>

    <div class="mt-2 text-xs text-muted sm:text-sm">{{ formatDate(comment.createdAt, locale) }}</div>

    <p
      class="mt-2 sm:mt-3 whitespace-pre-line text-xs sm:text-sm md:text-base break-words"
      :class="{ 'text-muted italic': comment.deletedAt || perms.isBanned }"
    >
      {{ displayContent }}
    </p>

    <Gif
      v-if="allowGifs !== false && comment.gifUrl && !comment.deletedAt && !perms.isBanned"
      :content="comment.gifUrl"
    />

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
          :loading="reactionPending && state.userReaction?.type === 'LIKE'"
          :disabled="reactionPending"
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
          :loading="reactionPending && state.userReaction?.type === 'DISLIKE'"
          :disabled="reactionPending"
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
        <LazyEmojiPopover
          :commentId="comment.id"
          :articleId="comment.articleId"
          @reaction="handleEmojiReaction"
          @saved="emit('refresh', comment)"
        />
        <UTooltip
          v-if="state.publicationLikes > 0 && publication"
          :text="$t('articles.comments.likedByPublication', [publication.name])"
        >
          <div class="flex items-center gap-1">
            <UIcon size="20" name="mdi:heart" class="text-error" />
            <UserPicture :url="publication.logoUrl" size="mn" :name="publication.name" />
          </div>
        </UTooltip>
      </div>
    </div>

    <UButton
      v-if="comment.repliesHasMore"
      color="neutral"
      variant="soft"
      class="mt-4"
      :loading="pendingReplies.has(comment.id)"
      :disabled="pendingReplies.has(comment.id)"
      @click="emit('loadReplies', comment)"
      >{{ $t('articles.comments.loadMoreReplies') }}</UButton
    >

    <UModal
      v-model:open="showReportModal"
      scrollable
      :title="$t('articles.comments.reportComment')"
      :description="$t('articles.comments.reportDescription')"
      :dismissible="!reportPending"
      @after:enter="reportInput?.textareaRef?.focus()"
    >
      <template #body>
        <form :id="reportFormId" @submit.prevent="report">
          <UFormField :label="$t('articles.comments.reportReason')" name="reason" required>
            <UTextarea
              ref="reportInput"
              v-model="reportReason"
              name="reason"
              :placeholder="$t('articles.comments.reportReason')"
              :maxlength="160"
              :rows="3"
              required
              autoresize
              class="w-full"
              :disabled="reportPending"
            />
            <template #hint>{{ reportReason.length }}/160</template>
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="reportPending" @click="showReportModal = false">{{
            $t('common.actions.cancel')
          }}</UButton>
          <UButton type="submit" :form="reportFormId" :disabled="!reportReason.trim()" :loading="reportPending">{{
            $t('articles.comments.reportComment')
          }}</UButton>
        </div>
      </template>
    </UModal>

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
          <AppDateInput :modelValue="banExpiresAt" time @update:modelValue="banExpiresAt = $event || null" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showBanModal = false">{{
            $t('common.messages.deleteCancel')
          }}</UButton>
          <UButton color="error" :disabled="!banReason.trim()" :loading="moderationPending" @click="banUser">{{
            $t('articles.comments.banUser')
          }}</UButton>
        </div>
      </template>
    </UModal>
  </article>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CommentWithReplies } from '~~/types/comment'

const {
  comment,
  isReplying,
  publication,
  allowReplies = true,
  allowGifs = true,
  pendingReplies = new Set<string>(),
  pendingContexts = new Set<string>(),
} = defineProps<{
  comment: CommentWithReplies
  isReplying: boolean
  depth: number
  publication: { name: string; logoUrl?: string | null } | null
  allowReplies?: boolean
  allowGifs?: boolean
  pendingReplies?: ReadonlySet<string>
  pendingContexts?: ReadonlySet<string>
}>()
const emit = defineEmits<{
  (e: 'reply' | 'like' | 'dislike' | 'loadReplies' | 'loadContext' | 'refresh', c: CommentWithReplies): void
  (e: 'delete', c: CommentWithReplies, reason: string | null): void
}>()

const toast = useToast()
const { locale } = useI18n()

const showDeleteModal = shallowRef(false)
const showBanModal = shallowRef(false)
const showReportModal = shallowRef(false)
const reportReason = shallowRef('')
const reportInput = useTemplateRef('reportInput')
const reportFormId = useId()
const reportPending = shallowRef(false)
const moderationPending = shallowRef(false)
const deleteReason = shallowRef('')
const banReason = shallowRef('')
const banExpiresAt = shallowRef<string | null>(null)

const commentRef = computed(() => comment)
const isReplyingRef = computed(() => isReplying)
const perms = useCommentPermissions(commentRef, isReplyingRef)

const commentActions = computed(() => {
  const actions: DropdownMenuItem[] = []
  if (perms.report)
    actions.push({
      label: $t('articles.comments.reportComment'),
      icon: 'mdi:flag-outline',
      onSelect: () => {
        showReportModal.value = true
      },
    })
  if (perms.ban)
    actions.push({
      label: $t('articles.comments.banUser'),
      icon: 'mdi:account-cancel',
      color: 'warning',
      onSelect: () => {
        showBanModal.value = true
      },
    })
  if (perms.unban)
    actions.push({ label: $t('articles.comments.unbanUser'), icon: 'mdi:account-check', onSelect: () => unbanUser() })
  if (!comment.deletedAt && perms.deleteOwn)
    actions.push({
      label: $t('articles.comments.deleteComment'),
      icon: 'mdi:delete-outline',
      color: 'error',
      onSelect: () => emit('delete', comment, null),
    })
  else if (!comment.deletedAt && perms.moderateDelete)
    actions.push({
      label: $t('articles.comments.deleteCommentAdmin'),
      icon: 'mdi:delete-outline',
      color: 'error',
      onSelect: () => {
        showDeleteModal.value = true
      },
    })
  return actions
})

const displayContent = computed(() =>
  comment.deletedAt
    ? $t('articles.comments.deletedComment')
    : perms.isBanned
      ? $t('articles.comments.bannedUserComment')
      : comment.content,
)

const userCardProps = computed(() => {
  const u = comment.user
  if (!u || u.isBanned) return null
  return {
    id: comment.userId,
    username: u.username,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
  }
})

const {
  state,
  isPending: reactionPending,
  updateReaction,
  handleEmojiReaction,
} = useCommentReactions(commentRef, {
  isSiteAdmin: toRef(perms, 'isSiteAdmin'),
  currentUserId: computed(() => perms.user?.id),
  onSaved: () => emit('refresh', comment),
})

const report = async () => {
  if (reportPending.value || !reportReason.value.trim()) return
  reportPending.value = true
  try {
    await $fetch<unknown, '/api/notifications'>('/api/notifications', {
      method: 'POST',
      body: { commentId: comment.id, reason: reportReason.value.trim() },
    })
    showReportModal.value = false
    reportReason.value = ''
    toast.add({ color: 'success', title: $t('common.messages.reportSuccess') })
  } catch (error) {
    toast.add({
      id: `comment-report-${comment.id}`,
      color: 'error',
      title: fetchErrorMessage(error, $t('common.messages.reportFailed')),
    })
  } finally {
    reportPending.value = false
  }
}

const confirmDelete = () => {
  emit('delete', comment, deleteReason.value)
  showDeleteModal.value = false
  deleteReason.value = ''
}

const banUser = async () => {
  if (!banReason.value.trim() || moderationPending.value) return
  moderationPending.value = true
  try {
    await $fetch<unknown, '/api/bans/:id'>(`/api/bans/${comment.id}` as '/api/bans/:id', {
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
    emit('refresh', comment)
  } catch (e: unknown) {
    toast.add({
      color: 'error',
      title: fetchErrorMessage(e, $t('articles.comments.banFailed')),
    })
  } finally {
    moderationPending.value = false
  }
}

const unbanUser = async () => {
  if (moderationPending.value) return
  moderationPending.value = true
  try {
    await $fetch<unknown, '/api/bans/:id'>(`/api/bans/${comment.id}` as '/api/bans/:id', { method: 'DELETE' })
    toast.add({
      color: 'success',
      title: $t('articles.comments.unbanSuccess'),
    })
    emit('refresh', comment)
  } catch (e: unknown) {
    toast.add({
      color: 'error',
      title: fetchErrorMessage(e, $t('articles.comments.unbanFailed')),
    })
  } finally {
    moderationPending.value = false
  }
}
</script>
