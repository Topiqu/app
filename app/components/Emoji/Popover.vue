<template>
  <Popover v-slot="{ close }" class="relative">
    <PopoverButton
      v-if="session?.user"
      class="flex items-center gap-1 px-2 py-1.5 text-sm font-medium rounded-xl bg-white hover:bg-gray-100 transition-colors shadow-sm cursor-pointer"
    >
      <Icon name="mdi:emoticon-outline" class="w-5 h-5 text-gray-500" />
      <span class="text-gray-500 text-base leading-none">+</span>
    </PopoverButton>
    <TransitionRoot appear>
      <TransitionChild
        enter="transition ease-out duration-200"
        enter-from="opacity-0 -translate-y-2"
        enter-to="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leave-from="opacity-100 translate-y-0"
        leave-to="opacity-0 -translate-y-2"
      >
        <PopoverPanel
          class="absolute bottom-full right-0 z-20 mb-2 w-52 p-3 bg-white rounded-2xl shadow-2xl border border-gray-200"
        >
          <div v-if="loading" class="p-2 text-gray-600 text-xs">Načítání…</div>
          <div v-else-if="error" class="p-2 text-red-600 text-xs">Chyba při načítání</div>
          <div v-else-if="!emojis?.length" class="p-2 text-gray-600 text-xs">Žádná emoji</div>
          <div v-else class="grid grid-cols-5 gap-10">
            <button
              v-for="emoji in emojis"
              :key="emoji.id"
              class="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              @click="toggleEmoji(emoji.id, close)"
            >
              <img :src="emoji.imageUrl" :alt="emoji.shortcode" class="w-6 h-6 object-contain" loading="lazy" />
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
