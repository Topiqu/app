<template>
  <UPopover v-model:open="open" :content="{ side: 'top', align: 'end', sideOffset: 8 }">
    <UButton
      v-if="session?.user"
      color="neutral"
      variant="ghost"
      icon="mdi:emoticon-outline"
      :aria-label="$t('articles.comments.addReaction')"
    />
    <template #content="{ close }">
      <div class="w-64 p-3">
        <UProgress v-if="loading" />
        <UAlert
          v-else-if="error"
          color="error"
          variant="soft"
          icon="mdi:alert-circle-outline"
          :title="$t('common.error')"
        />
        <UEmpty v-else-if="!emojis?.length" size="sm" icon="mdi:emoticon-sad-outline" :title="$t('common.noItems')" />
        <div v-else class="grid grid-cols-5 gap-2">
          <UTooltip v-for="emoji in emojis" :key="emoji.id" :text="emoji.shortcode">
            <UButton
              color="neutral"
              variant="soft"
              square
              :aria-label="emoji.shortcode"
              @click="toggleEmoji(emoji.id, close)"
            >
              <AppMedia
                :src="emoji.imageUrl"
                :alt="emoji.shortcode"
                aspectRatio="1 / 1"
                fit="contain"
                sizes="24px"
                containerClass="size-6 bg-transparent"
              />
            </UButton>
          </UTooltip>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
const props = defineProps<{ commentId: string; articleId: string }>()
const emit = defineEmits<{
  (
    e: 'reaction',
    data: {
      commentId: string
      emojiId: string
      userId: string
      shortcode: string
      imageUrl: string
      revert?: boolean
    },
  ): void
}>()

const toast = useToast()
const { data: session } = useAuth()
const open = shallowRef(false)

const {
  data: emojis,
  pending: loading,
  error,
  refresh,
} = await useFetch(`/api/emojis/${props.articleId}/by-article`, { server: false, immediate: false })

watch(open, (isOpen) => {
  if (isOpen && session.value?.user) void refresh()
})

const toggleEmoji = async (emojiId: string, close: () => void) => {
  const emoji = emojis.value!.find((e) => e.id === emojiId)!
  emit('reaction', {
    commentId: props.commentId,
    emojiId,
    shortcode: emoji.shortcode,
    imageUrl: emoji.imageUrl,
    userId: session.value!.user.id,
  })
  close()
  try {
    const res = await $fetch('/api/emojis/reaction', { method: 'POST', body: { commentId: props.commentId, emojiId } })
    if (!res.success) throw new Error()
  } catch {
    toast.add({ color: 'error', title: $t('articles.comments.reactionFailed') })
    emit('reaction', {
      commentId: props.commentId,
      emojiId,
      shortcode: emoji.shortcode,
      imageUrl: emoji.imageUrl,
      userId: session.value!.user.id,
      revert: true,
    })
  }
}
</script>
