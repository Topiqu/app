<template>
  <ModalMini
    v-model:open="isOpen"
    :title="title"
    :confirmText="$t('common.continue')"
    :cancelText="$t('common.close')"
    @confirm="confirm"
    @cancel="isOpen = false"
  >
    <template #content>
      <FormInput
        v-model="url"
        :placeholder="type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'"
        :icon="icon"
        @keydown.enter.prevent.stop="confirm"
      />
      <p v-if="error" class="mt-2 text-xs text-red-500" role="alert">{{ error }}</p>
      <Button
        v-if="type === 'link' && isLinkActive"
        variant="danger"
        size="sm"
        icon="mdi:link-off"
        class="mt-3"
        @click="emit('remove')"
      >
        {{ $t('articles.editor.toolbar.removeLink') }}
      </Button>
    </template>
  </ModalMini>
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

const icon = computed(() => (type === 'image' ? 'mdi:image' : type === 'youtube' ? 'mdi:youtube' : 'mdi:link'))

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
