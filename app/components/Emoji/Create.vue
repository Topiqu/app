<template>
  <Modal v-model="open" :title="$t('emoji.create')" :onClose="confirmClose">
    <template #default="actions">
      <slot v-bind="actions" />
    </template>

    <template #content>
      <form class="mt-6 flex flex-col gap-6" @submit.prevent="submit">
        <label class="flex flex-col gap-2">
          <span class="text-sm font-semibold uppercase tracking-wide">{{ $t('common.labels.shortcode') }}</span>
          <input
            v-model="shortcode"
            :placeholder="$t('emoji.shortcodePlaceholder')"
            class="p-4 rounded-xl border shadow-inner bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            required
          />
        </label>
        <FileUploader type="emoji" :shortcode="shortcode" :disabled="!shortcode" @upload="onUpload" />
      </form>

      <div class="mt-8">
        <div v-if="loading && !emojis?.length" class="text-sm">{{ $t('common.loading') }}</div>
        <div v-else-if="error" class="text-sm">{{ error }}</div>
        <div v-else ref="scrollParent" class="rounded-xl border shadow-inner">
          <div v-auto-animate :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
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
          <div v-if="!emojis?.length" class="px-2 py-4 text-sm text-center">{{ $t('emoji.noEmojisFound') }}</div>
        </div>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex gap-4 justify-end mt-6 flex-shrink-0 pt-4 border-t">
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-sm"
          @click="close"
        >
          {{ $t('common.messages.deleteCancel') }}
        </button>
        <button
          class="px-5 py-2.5 rounded-xl text-sm font-medium transition transform hover:scale-105 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!shortcode || !imageUrl"
          @click="submit"
        >
          {{ $t('emoji.create') }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import Swal from 'sweetalert2'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { vAutoAnimate } from '@formkit/auto-animate/vue'

const toast = useToast()
const open = defineModel<boolean>()
const shortcode = shallowRef<string>('')
const imageUrl = shallowRef<string | null>(null)
const scrollParent = useTemplateRef('scrollParent')

const { data: emojis, pending: loading, error, refresh } = await useFetch('/api/emojis')

const count = computed(() => emojis.value?.length || 0)

const virtualizer = useVirtualizer({
  get count() {
    return count.value
  },
  getScrollElement: () => scrollParent.value,
  estimateSize: () => 60,
  overscan: 5,
})

const onUpload = ({ url }: { url: string }) => {
  imageUrl.value = url
}

const submit = async () => {
  if (!shortcode.value || !imageUrl.value) return
  try {
    const res = await $fetch('/api/emojis', {
      method: 'POST',
      body: { shortcode: shortcode.value, imageUrl: imageUrl.value },
    })
    if (res.success && res.emoji) {
      toast.success({ message: $t('emoji.createSuccess', [res.emoji.shortcode]) })
      shortcode.value = ''
      imageUrl.value = null
      await refresh()
    } else {
      toast.error({ message: error.value?.message || $t('emoji.createFailed') })
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('emoji.createFailed') })
  }
}

const deleteEmoji = async (id: string) => {
  try {
    const res = await $fetch(`/api/emojis/${id}` as `/api/emojis/:id`, { method: 'DELETE' })
    if (res.success) {
      toast.success({ message: $t('emoji.deleteSuccess') })
      await refresh()
    } else {
      toast.error({ message: error.value?.message || $t('emoji.deleteFailed') })
    }
  } catch (e: any) {
    toast.error({ message: e.data?.message || $t('emoji.deleteFailed') })
  }
}

const confirmClose = async () => {
  if (!shortcode.value && !imageUrl.value) return (open.value = false)
  const r = await Swal.fire({
    title: $t('common.messages.closeConfirmTitle'),
    text: $t('common.messages.closeConfirmText'),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: $t('common.messages.closeConfirmButton'),
    cancelButtonText: $t('common.messages.deleteCancel'),
    confirmButtonColor: '#ef4444',
  })
  if (r.isConfirmed) open.value = false
}
</script>
