<template>
  <div data-font-upload-slot class="min-w-0 rounded-(--topiqu-surface-radius) border border-default bg-default p-3">
    <div class="flex min-w-0 items-center gap-3">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-lg bg-elevated text-lg font-semibold text-highlighted"
        :style="url ? { fontFamily } : undefined"
        aria-hidden="true"
      >
        Aa
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-highlighted">{{ label }}</p>
        <p class="truncate text-xs text-muted">
          {{ url ? $t('common.preferences.branding.fontUploaded') : $t('common.preferences.branding.fontMissing') }}
        </p>
      </div>
      <UButton
        v-if="url"
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="mdi:delete-outline"
        :aria-label="$t('common.actions.delete')"
        :loading="busy"
        class="shrink-0"
        @click="remove"
      />
    </div>
    <UFileUpload
      v-model="pickedFile"
      accept=".woff2,font/woff2"
      :aria-label="label"
      :preview="false"
      :disabled="busy || !clientId"
      :label="$t('common.preferences.branding.uploadFont')"
      :description="$t('common.preferences.branding.dropFontHelp')"
      icon="mdi:file-upload-outline"
      reset
      class="mt-3 min-w-0"
      :ui="{
        base: [
          'min-h-24 min-w-0 px-3 py-3 transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-primary/10',
          !busy && clientId && 'cursor-pointer hover:border-primary hover:bg-primary/5',
        ],
        wrapper: 'min-w-0',
        label: 'max-w-full [overflow-wrap:anywhere]',
        description: 'max-w-full [overflow-wrap:anywhere]',
      }"
      @update:modelValue="upload"
    >
      <template v-if="url" #default="{ open }">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="sm"
          block
          icon="mdi:file-replace-outline"
          :loading="busy"
          :label="$t('common.preferences.branding.changeFont')"
          @click="open()"
        />
      </template>
    </UFileUpload>
    <p v-if="error" role="alert" class="mt-2 text-xs text-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  fontRole: 'heading' | 'body'
  clientId: string
  url: string
}>()
const emit = defineEmits<{ 'update:url': [url: string] }>()
const pickedFile = shallowRef<File | null>(null)
const busy = shallowRef(false)
const error = shallowRef('')
const label = computed(() =>
  props.fontRole === 'heading'
    ? $t('common.preferences.branding.headingFont')
    : $t('common.preferences.branding.bodyFont'),
)
// Families registered by the typography editor's @font-face preview.
const fontFamily = computed(() =>
  props.fontRole === 'heading' ? '"Topiqu Custom Heading", sans-serif' : '"Topiqu Custom Body", sans-serif',
)

const upload = async (file: File | null | undefined) => {
  pickedFile.value = null
  if (!file || !props.clientId) return
  error.value = ''
  if (!file.name.toLowerCase().endsWith('.woff2') || file.size > 2 * 1024 * 1024) {
    error.value = $t('common.preferences.branding.fontFormatError')
    return
  }
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (String.fromCharCode(...header) !== 'wOF2') {
    error.value = $t('common.preferences.branding.fontFormatError')
    return
  }
  busy.value = true
  try {
    const form = new FormData()
    form.append('slot', props.fontRole)
    form.append('file', file)
    const result = await $fetch<{ url: string }>(`/api/clients/${props.clientId}/fonts`, {
      method: 'POST',
      body: form,
    })
    emit('update:url', result.url)
  } catch {
    error.value = $t('common.preferences.branding.fontUploadError')
  } finally {
    busy.value = false
  }
}
const remove = async () => {
  if (!props.url || !props.clientId) return
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/clients/${props.clientId}/fonts/${props.fontRole}`, { method: 'DELETE' })
    emit('update:url', '')
  } catch {
    error.value = $t('common.preferences.branding.fontUploadError')
  } finally {
    busy.value = false
  }
}
</script>
