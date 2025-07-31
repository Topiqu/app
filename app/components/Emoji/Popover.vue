<template>
  <Popover v-slot="{ close }" class="relative">
    <PopoverButton
      v-if="session?.user"
      class="flex items-center gap-1 px-2 py-1 text-xs sm:text-sm rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <Icon name="mdi:emoticon" class="w-4 h-4" />
      <span>Emoji</span>
    </PopoverButton>
    <TransitionRoot>
      <TransitionChild
        enter="transition duration-200 ease-out"
        enter-from="opacity-0 translate-y-1"
        enter-to="opacity-100 translate-y-0"
        leave="transition duration-150 ease-in"
        leave-from="opacity-100 translate-y-0"
        leave-to="opacity-0 translate-y-1"
      >
        <PopoverPanel class="absolute z-10 mt-2 w-32 bg-white rounded-xl shadow-lg border border-gray-200">
          <div v-if="loading" class="p-2 text-gray-600 text-xs">Načítání...</div>
          <div v-else-if="error" class="p-2 text-red-600 text-xs">Chyba při načítání emoji</div>
          <div v-else-if="!emojis?.length" class="p-2 text-gray-600 text-xs">Žádná emoji</div>
          <div v-else class="p-2 grid grid-cols-4 gap-1">
            <button
              v-for="emoji in emojis"
              :key="emoji.id"
              class="p-1 hover:bg-gray-100 rounded"
              @click="toggleEmoji(emoji.id, close)"
            >
              <img :src="emoji.imageUrl" :alt="emoji.shortcode" class="w-6 h-6" />
            </button>
          </div>
        </PopoverPanel>
      </TransitionChild>
    </TransitionRoot>
  </Popover>
</template>

<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'

const props = defineProps<{ commentId: string; articleId: string }>()
const emit = defineEmits<{ (e: 'reaction'): void }>()

const toast = useToast()
const { data: session } = useAuth()

const {
  data: emojis,
  pending: loading,
  error,
} = await useFetch(`/api/emojis/${props.articleId}/by-article`, {
  immediate: true,
  server: false,
})

const toggleEmoji = async (emojiId: string, close: () => void) => {
  const res = await $fetch('/api/emojis/reaction', {
    method: 'POST',
    body: { commentId: props.commentId, emojiId },
  })

  close()
  if (res.success && res.created != null) {
    toast.success({ message: res.created ? 'Emoji přidáno' : 'Emoji odebráno' })
    emit('reaction')
  } else {
    toast.error({ message: 'Nepodařilo se přidat/odebrat emoji' })
  }
}
</script>
