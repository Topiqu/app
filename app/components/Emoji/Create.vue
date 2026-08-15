<template>
  <UModal
    v-model:open="open"
    :title="$t('emoji.create')"
    :dismissible="false"
    :close="false"
    @close:prevent="confirmClose"
  >
    <slot :open="open" />

    <template #body>
      <UForm :state="emojiState" @submit.prevent="submit">
        <div class="flex flex-col gap-6">
          <UFormField :label="$t('common.labels.shortcode')">
            <UInput v-model="shortcode" :placeholder="$t('emoji.shortcodePlaceholder')" class="w-full" required />
          </UFormField>
          <FileUploader
            type="emoji"
            :shortcode="shortcode"
            :maxWidth="2560"
            :maxHeight="1440"
            :disabled="!shortcode"
            @upload="onUpload"
          />
        </div>
      </UForm>

      <div class="mt-8">
        <UProgress v-if="loading && !emojis?.length" animation="carousel" />
        <UAlert v-else-if="error" color="error" variant="soft" :description="String(error)" />
        <UCard v-else>
          <div ref="scrollParent" class="overflow-y-auto">
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
                class="flex items-center justify-between border-b border-default px-3 py-2"
              >
                <div class="flex items-center gap-3">
                  <AppMedia
                    :src="emojis![virtualRow.index]?.imageUrl"
                    :alt="emojis![virtualRow.index]?.shortcode ?? ''"
                    aspectRatio="1 / 1"
                    fit="contain"
                    sizes="24px"
                    containerClass="size-6 rounded"
                  />
                  <span class="text-sm font-medium">{{ emojis![virtualRow.index]?.shortcode }}</span>
                </div>
                <UButton
                  color="error"
                  variant="ghost"
                  square
                  icon="i-mdi-delete"
                  :aria-label="$t('common.actions.deleteEmoji')"
                  :title="$t('common.actions.deleteEmoji')"
                  @click="deleteEmoji(emojis![virtualRow.index]?.id!)"
                />
              </div>
            </div>
            <UEmpty v-if="!emojis?.length" size="sm" :description="$t('emoji.noEmojisFound')" />
          </div>
        </UCard>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-4 justify-end shrink-0 pt-4">
        <UButton color="neutral" variant="soft" size="lg" @click="confirmClose">{{
          $t('common.messages.deleteCancel')
        }}</UButton>
        <UButton :disabled="!shortcode || !imageUrl" @click="submit">{{ $t('emoji.create') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { vAutoAnimate } from '@formkit/auto-animate/vue'

const toast = useToast()
const open = defineModel<boolean>({ default: false })
const confirm = useConfirm()
const shortcode = shallowRef<string>('')
const imageUrl = shallowRef<string | null>(null)
const optimizedImageUrl = shallowRef<string | null>(null)
const scrollParent = useTemplateRef('scrollParent')
const emojiState = computed(() => ({ imageUrl: imageUrl.value, shortcode: shortcode.value }))

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

const onUpload = ({ url, optimizedUrl }: { url: string; optimizedUrl: string }) => {
  imageUrl.value = url
  optimizedImageUrl.value = optimizedUrl
}

const submit = async () => {
  if (!shortcode.value || !imageUrl.value) return
  try {
    const res = await $fetch('/api/emojis', {
      method: 'POST',
      body: { shortcode: shortcode.value, imageUrl: imageUrl.value },
    })
    if (res.success && res.emoji) {
      toast.add({ color: 'success', title: $t('emoji.createSuccess', [res.emoji.shortcode]) })
      shortcode.value = ''
      imageUrl.value = null
      await refresh()
    } else {
      toast.add({ color: 'error', title: error.value?.message || $t('emoji.createFailed') })
    }
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || $t('emoji.createFailed') })
  }
}

const deleteEmoji = async (id: string) => {
  try {
    const res = await $fetch(`/api/emojis/${id}` as `/api/emojis/:id`, { method: 'DELETE' })
    if (res.success) {
      toast.add({ color: 'success', title: $t('emoji.deleteSuccess') })
      await refresh()
    } else {
      toast.add({ color: 'error', title: error.value?.message || $t('emoji.deleteFailed') })
    }
  } catch (e: any) {
    toast.add({ color: 'error', title: e.data?.message || $t('emoji.deleteFailed') })
  }
}

const confirmClose = async () => {
  if (!shortcode.value && !imageUrl.value) return (open.value = false)
  const r = await confirm({
    title: $t('common.messages.closeConfirmTitle'),
    message: $t('common.messages.closeConfirmText'),
    icon: 'i-mdi-alert-outline',
    confirmText: $t('common.messages.closeConfirmButton'),
    cancelText: $t('common.messages.deleteCancel'),
    variant: 'danger',
  })
  if (r) open.value = false
}
</script>
