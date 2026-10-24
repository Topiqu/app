<template>
  <div class="topiqu-dashboard-page flex min-h-0 flex-1 flex-col gap-5 py-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">{{ $t('media.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ $t('media.description') }}</p>
      </div>
      <UButton icon="mdi:cloud-upload-outline" class="shrink-0" @click="uploadOpen = true">{{
        $t('media.upload')
      }}</UButton>
    </header>

    <MediaLibrary ref="library" @inspect="inspect" />

    <UModal v-model:open="uploadOpen" :title="$t('media.uploadTitle')">
      <template #body>
        <FileUploader type="article-image" aspectRatio="16 / 9" @upload="uploaded" />
      </template>
    </UModal>
    <MediaDetail :id="detailId" v-model:open="detailOpen" @updated="refresh" @removed="refresh" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'admin', shell: 'dashboard' })
useSeoMeta({ title: () => $t('media.title') })

const uploadOpen = shallowRef(false)
const detailOpen = shallowRef(false)
const detailId = shallowRef<string | null>(null)
const library = useTemplateRef<{ reload: () => Promise<void> }>('library')
const inspect = (id: string) => {
  detailId.value = id
  detailOpen.value = true
}
const refresh = () => library.value?.reload()
const uploaded = async (payload: { mediaAsset?: { id: string } }) => {
  if (!payload.mediaAsset?.id) return
  uploadOpen.value = false
  await refresh()
  inspect(payload.mediaAsset.id)
}
</script>
