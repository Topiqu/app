<template>
  <UModal v-model:open="isOpen" :title="title">
    <template #body>
      <UFormField :label="title" :error="error || undefined">
        <UInput
          v-model="url"
          :placeholder="type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'"
          :icon="icon"
          @keydown.enter.prevent.stop="confirm"
        />
      </UFormField>
      <UButton
        v-if="type === 'link' && isLinkActive"
        color="error"
        variant="solid"
        size="sm"
        icon="i-mdi-link-off"
        class="mt-3"
        @click="emit('remove')"
      >
        {{ $t('articles.editor.toolbar.removeLink') }}
      </UButton>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">{{ $t('common.close') }}</UButton>
        <UButton :disabled="!!error" icon="i-mdi-check" @click="confirm">{{ $t('common.continue') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
type LinkType = 'link' | 'image' | 'youtube'

const isOpen = defineModel<boolean>('open', { default: false })
const url = defineModel<string>('url', { default: '' })

const { type, isLinkActive } = defineProps<{ type: LinkType; isLinkActive: boolean }>()
const emit = defineEmits<{ (e: 'submit', url: string): void; (e: 'remove'): void }>()

const error = shallowRef('')

watch(isOpen, (open) => open && (error.value = ''))

const title = computed(() =>
  type === 'link'
    ? $t('articles.sources.placeholder')
    : type === 'image'
      ? $t('articles.sources.imageUrl')
      : $t('articles.sources.youtube'),
)

const icon = computed(() => (type === 'image' ? 'i-mdi-image' : type === 'youtube' ? 'i-mdi-youtube' : 'i-mdi-link'))

const isValidUrl = (raw: string) => {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const confirm = () => {
  const v = url.value.trim()
  if (!v && type === 'link') {
    emit('submit', '')
    isOpen.value = false
    return
  }
  if (!isValidUrl(v)) {
    error.value = $t('common.errTypes.badRequest')
    return
  }
  emit('submit', v)
  isOpen.value = false
}
</script>
