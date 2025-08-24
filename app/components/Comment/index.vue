<template>
  <div
    :id="`comment-${comment.id}`"
    class="relative w-full min-w-fit bg-white pt-2 pb-0.5 pl-2 pr-0.5 sm:pt-4 sm:pb-1 sm:pl-4 sm:pr-1 md:pt-6 md:pb-1.5 md:pl-6 md:pr-1.5 rounded-3xl shadow border border-gray-200"
  >
    <div class="absolute top-2 right-2 sm:top-3 sm:right-3 flex gap-2 z-10">
      <button
        v-if="session?.user && comment.deletedAt === null && !comment.user?.isBanned"
        class="p-0 m-0 bg-transparent hover:bg-transparent border-none outline-none"
        aria-label="Nahlásit komentář"
        title="Nahlásit komentář"
        @click="report(comment)"
      >
        <Icon
          name="mdi:flag-outline"
          class="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 cursor-pointer"
        />
      </button>
      <button
        v-if="
          session?.user &&
          session.user.role === 'admin' &&
          session.user.clientSiteId === comment.article?.clientSiteId &&
          session.user.id !== comment.userId &&
          !comment.user?.isBanned
        "
        class="p-0 m-0 bg-transparent hover:bg-transparent border-none outline-none"
        aria-label="Zabanovat uživatele"
        title="Zabanovat uživatele"
        @click="openBanModal(comment)"
      >
        <Icon
          name="mdi:account-cancel"
          class="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 hover:text-orange-600 cursor-pointer"
        />
      </button>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pr-2 sm:pr-4 md:pr-6">
      <div class="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base flex-wrap">
        <UserCard
          v-if="comment.user && !comment.user.isBanned"
          :user="{
            id: comment.userId,
            username: comment.user.username,
            email: comment.user.email!,
            createdAt: comment.user.createdAt,
            avatarUrl: comment.user.avatarUrl,
            bio: comment.user.bio,
            lastLogin: comment.user.lastLogin,
            commentsCount: comment.user.commentsCount,
            likesCount: comment.user.likesCount,
            dislikesCount: comment.user.dislikesCount,
            followers: comment.user.followers,
            following: comment.user.following,
            role: comment.user.role,
          }"
        />
        <span v-else-if="comment.user?.isBanned" class="font-semibold text-red-500">
          Zabanovaný uživatel
          <span v-if="comment.user.banDetails?.reason && session?.user.role == 'admin'"
            >({{ comment.user.banDetails.reason }})</span
          >
          <span v-if="comment.user.banDetails?.expiresAt && session?.user.role == 'admin'">
            do {{ new Date(comment.user.banDetails.expiresAt).toLocaleString() }}
          </span>
        </span>
        <span v-else class="font-semibold text-gray-800">Není k dispozici</span>
      </div>
      <div v-if="!comment.deletedAt" class="flex flex-col gap-1 sm:gap-2">
        <button
          v-if="session?.user && !isReplying && !comment.user?.isBanned"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Odpovědět"
          @click="$emit('reply', comment)"
        >
          <Icon name="mdi:reply" class="w-4 h-4 text-gray-600" />
          <span class="hidden sm:inline">Odpovědět</span>
        </button>
        <button
          v-if="session?.user && session.user.id === comment.userId"
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Smazat komentář"
          @click="$emit('delete', comment, null)"
        >
          <Icon name="mdi:delete" class="w-4 h-4 text-red-500" />
          <span class="hidden sm:inline">Smazat</span>
        </button>
        <button
          v-else-if="
            session?.user &&
            session.user.role === 'admin' &&
            session.user.id === comment.article?.userId &&
            !comment.user?.isBanned
          "
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Smazat komentář (admin)"
          @click="showDeleteModal(comment)"
        >
          <Icon name="mdi:delete" class="w-4 h-4 text-red-500" />
          <span class="hidden sm:inline">Smazat (admin)</span>
        </button>
        <button
          v-if="
            session?.user &&
            session.user.role === 'admin' &&
            session.user.clientSiteId === comment.article?.clientSiteId &&
            session.user.id !== comment.userId &&
            comment.user?.isBanned
          "
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-xl shadow-sm border border-gray-200 bg-gray-50 cursor-pointer"
          aria-label="Odbanovat uživatele"
          @click="unbanUser(comment)"
        >
          <Icon name="mdi:account-check" class="w-4 h-4 text-green-500" />
          <span class="hidden sm:inline">Odbanovat</span>
        </button>
      </div>
    </div>
    <p
      class="mt-4 sm:mt-6 whitespace-pre-line text-xs sm:text-sm md:text-base break-words"
      :class="{ 'text-gray-400 italic': comment.deletedAt || comment.user?.isBanned }"
    >
      {{
        comment.deletedAt
          ? '[Tento komentář byl smazán]'
          : comment.user?.isBanned
            ? '[Komentář od zabanovaného uživatele]'
            : comment.content
      }}
    </p>

    <div
      v-if="!comment.deletedAt && !comment.user?.isBanned"
      class="mt-4 sm:mt-5 flex items-center justify-between flex-wrap gap-2 sm:gap-3 pb-2 sm:pb-4 md:pb-6"
    >
      <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 cursor-pointer bg-gray-100"
          :class="comment.userReaction?.type === 'LIKE' ? 'bg-green-100 text-green-600' : 'text-gray-600'"
          @click="$emit('like', comment)"
        >
          <Icon name="mdi:thumb-up-outline" class="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{{ comment.likes || 0 }}</span>
        </button>
        <button
          class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 cursor-pointer bg-gray-100"
          :class="comment.userReaction?.type === 'DISLIKE' ? 'bg-red-100 text-red-600' : 'text-gray-600'"
          @click="$emit('dislike', comment)"
        >
          <Icon name="mdi:thumb-down-outline" class="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{{ comment.dislikes || 0 }}</span>
        </button>

        <div v-if="comment.emojiReactions?.length" class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div
            v-for="reaction in comment.emojiReactions"
            :key="reaction.emojiId"
            v-tippy="{ content: reaction.emoji.shortcode, placement: 'top' }"
            class="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 bg-gray-100 text-gray-600"
          >
            <img :src="reaction.emoji.imageUrl" :alt="reaction.emoji.shortcode" class="w-4 h-4 sm:w-5 sm:h-5" />
            <span>{{ reaction.count }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        <LazyEmojiPopover :commentId="comment.id" :articleId="comment.articleId!" @reaction="$emit('refresh')" />
        <div
          v-if="comment.isLikedByAuthor"
          v-tippy="{ content: `Líbí se autorovi (${authorData?.username || 'Autor'})`, placement: 'top' }"
          class="flex items-center gap-1"
        >
          <Icon name="mdi:heart" class="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          <img
            v-if="authorData?.avatarUrl"
            :src="authorData.avatarUrl"
            :alt="authorData.username"
            class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-gray-200"
          />
          <span
            v-else
            class="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs sm:text-sm text-gray-600 font-semibold"
          >
            {{ authorData?.username?.charAt(0) || 'A' }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="comment.replies?.length" class="mt-4 sm:mt-6 space-y-4">
      <Comment
        v-for="reply in comment.replies"
        :key="reply.id"
        :comment="reply"
        :isReplying="isReplying"
        :depth="depth < 12 ? depth + 1 : depth"
        @reply="$emit('reply', $event)"
        @delete="(comment, reason) => $emit('delete', comment, reason)"
        @like="$emit('like', $event)"
        @dislike="$emit('dislike', $event)"
        @refresh="$emit('refresh')"
      />
    </div>

    <div
      v-if="showModal && selectedComment?.id === comment.id"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white p-6 rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Smazat komentář</h3>
        <p class="text-sm text-gray-600 mb-4">Zadejte důvod smazání (bude odeslán autorovi):</p>
        <textarea
          v-model="deleteReason"
          class="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-y min-h-[100px]"
          placeholder="Důvod smazání..."
          maxlength="255"
          required
        />
        <div class="flex justify-end gap-3 mt-4">
          <button
            class="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200"
            @click="((showModal = false), (deleteReason = ''))"
          >
            Zrušit
          </button>
          <button
            class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
            :disabled="!deleteReason.trim()"
            @click="emitDelete(comment, deleteReason)"
          >
            Smazat
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showBanModal && selectedComment?.id === comment.id"
      ref="banModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white p-6 rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Zabanovat uživatele</h3>
        <p class="text-sm text-gray-600 mb-4">Zadejte důvod banu (bude odeslán uživateli):</p>
        <textarea
          v-model="banReason"
          class="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-y min-h-[100px]"
          placeholder="Důvod banu..."
          maxlength="255"
          required
        />
        <div class="mt-4">
          <label class="text-sm text-gray-600">Expirace banu (nepovinné):</label>
          <input
            v-model="banExpiresAt"
            type="datetime-local"
            class="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm mt-2"
          />
        </div>
        <div class="flex justify-end gap-3 mt-4">
          <button
            class="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200"
            @click="((showBanModal = false), (banReason = ''), (banExpiresAt = ''))"
          >
            Zrušit
          </button>
          <button
            class="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
            :disabled="!banReason.trim()"
            @click="banUser(comment)"
          >
            Zabanovat
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentWithReplies } from '~~/types/comment'

import { directive as vTippy } from 'vue-tippy'
import 'tippy.js/dist/tippy.css'

const props = defineProps<{
  comment: CommentWithReplies
  isReplying: boolean
  depth: number
}>()

const emit = defineEmits<{
  (e: 'reply' | 'like' | 'dislike', comment: CommentWithReplies): void
  (e: 'delete', comment: CommentWithReplies, reason: string | null): void
  (e: 'refresh'): void
}>()

const { data: session } = useAuth()
const toast = useToast()
const showModal = shallowRef(false)
const showBanModal = shallowRef(false)
const selectedComment = shallowRef<CommentWithReplies | null>(null)
const deleteReason = shallowRef('')
const banReason = shallowRef('')
const banExpiresAt = shallowRef('')
const banModal = ref<HTMLElement | null>(null)
const { data: authorData } = await useFetch(`/api/users/${props.comment.article.userId}/author`, {
  key: `author-${props.comment.article.userId}`,
})
const report = async (c: CommentWithReplies) => {
  if (!confirm('Opravdu chcete nahlásit tento komentář?')) return
  try {
    await $fetch('/api/notifications', {
      method: 'POST',
      body: { commentId: c.id },
    })
    toast.success({ message: 'Komentář nahlášen' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Nahlášení selhalo' })
  }
}

const showDeleteModal = (c: CommentWithReplies) => {
  selectedComment.value = c
  showModal.value = true
}

const openBanModal = (c: CommentWithReplies) => {
  selectedComment.value = c
  showBanModal.value = true
}

const emitDelete = (comment: CommentWithReplies, reason: string) => {
  emit('delete', comment, reason)
  showModal.value = false
  deleteReason.value = ''
}

const banUser = async (comment: CommentWithReplies) => {
  if (!banReason.value.trim()) return
  try {
    await $fetch(`/api/bans/${comment.id}`, {
      method: 'POST',
      body: {
        reason: banReason.value,
        expiresAt: banExpiresAt.value || null,
      },
    })
    toast.success({ message: 'Uživatel zabanován' })
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Banování selhalo' })
  }
  showBanModal.value = false
}

const unbanUser = async (comment: CommentWithReplies) => {
  try {
    await $fetch(`/api/bans/${comment.id}`, {
      method: 'DELETE',
    })
    toast.success({ message: 'Uživatel odbanován' })
    emit('refresh')
  } catch (e: any) {
    toast.error({ message: e.data?.message || 'Odbanování selhalo' })
  }
}

onClickOutside(banModal, () => {
  showBanModal.value = false
  banReason.value = ''
  banExpiresAt.value = ''
})
</script>
