<template>
  <Dialog as="div" class="relative z-[1000]" @close="confirmClose">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div class="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity" />
    </TransitionChild>

    <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="ease-in duration-150"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        <DialogPanel
          class="w-full max-w-xl p-8 sm:p-10 rounded-3xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
        >
          <div class="flex-1 overflow-y-auto pr-2 sm:pr-4">
            <DialogTitle class="text-2xl font-semibold">Vytvořit emoji</DialogTitle>

            <form class="mt-6 flex flex-col gap-6" @submit.prevent="submit">
              <label class="flex flex-col gap-2">
                <span class="text-sm font-semibold uppercase tracking-wide">Shortcode</span>
                <input
                  v-model="shortcode"
                  placeholder="např. smile"
                  class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  required
                />
              </label>

              <label class="flex flex-col gap-2">
                <span class="text-sm font-semibold uppercase tracking-wide">Obrázek</span>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="p-3 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  required
                />
              </label>
            </form>

            <div class="mt-8">
              <DialogTitle class="text-lg font-semibold mb-2">Seznam emoji</DialogTitle>
              <div v-if="loading && !emojis?.length" class="text-sm">Načítání...</div>
              <div v-else-if="error" class="text-sm">{{ error }}</div>
              <div v-else ref="scrollParent" class="overflow-y-auto h-64 rounded-xl border shadow-inner">
                <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
                  <div
                    v-for="virtualRow in virtualizer.getVirtualItems()"
                    :key="String(virtualRow.key)"
                    :style="{
                      position: 'absolute',
                      top: `${virtualRow.start}px`,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                    }"
                    class="py-2 px-3 flex justify-between items-center transition border-b"
                  >
                    <div class="flex items-center gap-3">
                      <img
                        :src="emojis![virtualRow.index]?.imageUrl"
                        :alt="emojis![virtualRow.index]?.shortcode"
                        class="w-6 h-6 rounded"
                      />
                      <span class="text-sm font-medium">{{ emojis![virtualRow.index]?.shortcode }}</span>
                    </div>
                    <button
                      class="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
                      @click="deleteEmoji(emojis![virtualRow.index]?.id!)"
                    >
                      <Icon name="mdi:delete" class="text-red-500 w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div v-if="!emojis?.length" class="px-2 py-4 text-sm text-center">Žádná emoji nenalezena.</div>
              </div>
            </div>
          </div>

          <div class="flex gap-4 justify-end mt-6 flex-shrink-0 pt-4 border-t">
            <button
              class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-sm"
              @click="confirmClose"
            >
              Zrušit
            </button>
            <button
              class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              @click="submit"
            >
              Vytvořit
            </button>
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Dialog, DialogPanel, DialogTitle, TransitionChild } from '@headlessui/vue'

const toast = useToast()
const emit = defineEmits(['close'])

const shortcode = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const scrollParent = ref<HTMLElement | null>(null)

const {
  data: emojis,
  pending: loading,
  error,
  refresh,
} = await useFetch('/api/emojis', {
  immediate: true,
  server: false,
  query: { clientSiteId: useRuntimeConfig().public.clientSiteId },
})

const virtualizer = useVirtualizer({
  count: computed(() => emojis.value?.length || 0).value,
  getScrollElement: () => scrollParent.value,
  estimateSize: () => 60,
  overscan: 5,
})

const submit = async () => {
  if (!fileInput.value?.files?.[0]) return

  const formData = new FormData()
  formData.append('shortcode', shortcode.value)
  formData.append('image', fileInput.value.files[0])

  const res = await $fetch('/api/emojis', {
    method: 'POST',
    body: formData,
  })

  if (res.success && res.emoji) {
    toast.success({ message: `Emoji ${res.emoji.shortcode} přidáno` })

    shortcode.value = ''
    fileInput.value.value = ''

    await refresh()

    emit('close')
  } else {
    toast.error({ message: error.value?.message || 'Nepodařilo se přidat emoji' })
  }
}

const deleteEmoji = async (id: string) => {
  const res = await $fetch(`/api/emojis/${id}` as `/api/emojis/:id`, { method: 'DELETE' })

  if (res.success) {
    toast.success({ message: `Emoji smazáno` })

    await refresh()
  } else {
    toast.error({ message: error.value?.message || 'Nepodařilo se smazat emoji' })
  }
}

const confirmClose = async () => {
  if (!shortcode.value && !fileInput.value?.files?.[0]) return emit('close')

  const r = await Swal.fire({
    title: 'Zavřít dialog?',
    text: 'Přidávání emoji bude zrušeno. Opravdu chcete pokračovat?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ano, zavřít',
    cancelButtonText: 'Ne',
    confirmButtonColor: '#ef4444',
  })

  if (r.isConfirmed) emit('close')
}
</script>
