<template>
  <UModal
    v-model:open="open"
    :title="$t('articles.editor.xPost.title')"
    :description="$t('articles.editor.xPost.description')"
  >
    <template #body>
      <UFormField :label="$t('articles.editor.xPost.url')" :error="error || undefined">
        <UInput
          v-model="url"
          type="url"
          icon="mdi:twitter"
          class="w-full"
          :placeholder="$t('articles.editor.xPost.placeholder')"
          @keydown.enter.prevent.stop="submit"
        />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">{{ $t('common.close') }}</UButton>
        <UButton icon="mdi:check" :loading="pending" :disabled="!url.trim()" @click="submit">
          {{ $t('articles.editor.xPost.insert') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { XPostData } from '~~/shared/utils/articleEmbeds'

import { parseXPostUrl } from '~~/shared/utils/articleEmbeds'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ insert: [post: XPostData] }>()

const url = shallowRef('')
const error = shallowRef('')
const pending = shallowRef(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  url.value = ''
  error.value = ''
})

const submit = async () => {
  if (pending.value) return
  if (!parseXPostUrl(url.value)) {
    error.value = $t('articles.editor.xPost.errors.invalid')
    return
  }
  pending.value = true
  error.value = ''
  try {
    emit('insert', await $fetch<XPostData>('/api/embeds/x-post', { method: 'POST', body: { url: url.value } }))
    open.value = false
  } catch (failure) {
    error.value = fetchErrorMessage(failure, $t('articles.editor.xPost.errors.unavailable'))
  } finally {
    pending.value = false
  }
}
</script>
